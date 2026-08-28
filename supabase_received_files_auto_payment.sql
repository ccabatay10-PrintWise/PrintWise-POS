-- PrintWise Received Files - Automatic POS Payment Completion
-- Links received-file POS line items to the correct file job and marks the job PAID/COMPLETED after successful payment.

alter table public.received_file_jobs
  add column if not exists pos_order_id uuid,
  add column if not exists pos_order_no text,
  add column if not exists payment_status text,
  add column if not exists amount_paid numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists payment_date timestamptz,
  add column if not exists receipt_reference text,
  add column if not exists completed_at timestamptz;

create unique index if not exists received_file_jobs_pos_order_id_unique
  on public.received_file_jobs(pos_order_id)
  where pos_order_id is not null;

create or replace function public.printwise_link_received_file_job_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_job_id uuid;
  normalized_name text;
begin
  -- Regular POS products already have a product_id. Only received-file lines need this link.
  if new.product_id is not null then
    return new;
  end if;

  -- POS stores received-file items as: "Print: <original file name>".
  normalized_name := regexp_replace(coalesce(new.item_name, ''), '^Print:\\s*', '', 'i');

  select j.id into matched_job_id
  from public.received_file_items i
  join public.received_file_jobs j on j.id = i.job_id
  where j.status in ('PROCESSING', 'READY', 'REVIEWING')
    and j.pos_order_id is null
    and (
      lower(coalesce(i.original_name, '')) = lower(normalized_name)
      or lower(coalesce(i.final_name, '')) = lower(normalized_name)
    )
  order by j.updated_at desc, j.created_at desc
  limit 1;

  if matched_job_id is not null then
    update public.received_file_jobs j
       set pos_order_id = new.pos_order_id,
           pos_order_no = (select o.order_no from public.pos_orders o where o.id = new.pos_order_id),
           status = 'PROCESSING',
           updated_at = now()
     where j.id = matched_job_id
       and j.pos_order_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_printwise_link_received_file_job_to_order on public.pos_order_items;
create trigger trg_printwise_link_received_file_job_to_order
  after insert on public.pos_order_items
  for each row execute function public.printwise_link_received_file_job_to_order();

create or replace function public.printwise_complete_received_file_job_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'successful' and new.transaction_type = 'payment' then
    update public.received_file_jobs
       set status = 'COMPLETED',
           payment_status = 'PAID',
           amount_paid = greatest(coalesce(new.amount, 0), 0),
           payment_method = upper(replace(coalesce(new.channel::text, ''), '_', ' ')),
           payment_date = coalesce(new.created_at, now()),
           receipt_reference = new.transaction_no,
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
     where pos_order_id = new.pos_order_id
       and coalesce(payment_status, '') <> 'PAID';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_printwise_complete_received_file_job_after_payment on public.payment_transactions;
create trigger trg_printwise_complete_received_file_job_after_payment
  after insert on public.payment_transactions
  for each row execute function public.printwise_complete_received_file_job_after_payment();
