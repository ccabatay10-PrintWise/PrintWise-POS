-- PrintWise Received Files - Automatic POS Payment Completion
-- Keeps received-file jobs linked to POS orders and automatically marks paid jobs READY.
-- COMPLETED remains a separate manual final step when the physical job is released/finished.

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
  order_no_text text;
begin
  if new.product_id is not null then
    return new;
  end if;

  normalized_name := lower(trim(regexp_replace(coalesce(new.item_name, ''), '^Print:[[:space:]]*', '', 'i')));

  select order_no into order_no_text
  from public.pos_orders
  where id = new.pos_order_id;

  select j.id into matched_job_id
  from public.received_file_items i
  join public.received_file_jobs j on j.id = i.job_id
  where j.status in ('PROCESSING', 'READY', 'REVIEWING')
    and j.pos_order_id is null
    and (
      lower(trim(coalesce(i.original_name, ''))) = normalized_name
      or lower(trim(coalesce(i.final_name, ''))) = normalized_name
    )
  order by j.updated_at desc nulls last, j.created_at desc
  limit 1;

  if matched_job_id is not null then
    update public.received_file_jobs
       set pos_order_id = new.pos_order_id,
           pos_order_no = order_no_text,
           status = 'PROCESSING',
           payment_status = coalesce(payment_status, 'UNPAID'),
           updated_at = now()
     where id = matched_job_id
       and pos_order_id is null;
  end if;

  return new;
end;
$$;

create or replace function public.printwise_complete_received_file_job_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_job_id uuid;
  order_customer text;
  order_no_text text;
begin
  if lower(coalesce(new.status::text, '')) <> 'successful'
     or lower(coalesce(new.transaction_type::text, '')) <> 'payment'
     or new.pos_order_id is null then
    return new;
  end if;

  select customer_name, order_no
    into order_customer, order_no_text
  from public.pos_orders
  where id = new.pos_order_id;

  select id into target_job_id
  from public.received_file_jobs
  where pos_order_id = new.pos_order_id
  order by updated_at desc nulls last
  limit 1;

  if target_job_id is null and coalesce(trim(order_customer), '') <> '' then
    select id into target_job_id
    from public.received_file_jobs
    where lower(trim(customer_name)) = lower(trim(order_customer))
      and upper(coalesce(payment_status, 'UNPAID')) <> 'PAID'
      and status in ('PROCESSING', 'READY')
      and pos_order_id is null
    order by updated_at desc nulls last, created_at desc
    limit 1
    for update skip locked;
  end if;

  if target_job_id is not null then
    update public.received_file_jobs
       set pos_order_id = coalesce(pos_order_id, new.pos_order_id),
           pos_order_no = coalesce(pos_order_no, order_no_text),
           status = 'READY',
           payment_status = 'PAID',
           amount_paid = greatest(coalesce(new.amount, 0), 0),
           payment_method = upper(replace(coalesce(new.channel::text, ''), '_', ' ')),
           payment_date = coalesce(new.created_at, now()),
           paid_at = coalesce(paid_at, new.created_at, now()),
           receipt_reference = new.transaction_no,
           updated_at = now()
     where id = target_job_id
       and upper(coalesce(payment_status, 'UNPAID')) <> 'PAID';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_printwise_link_received_file_job_to_order on public.pos_order_items;
create trigger trg_printwise_link_received_file_job_to_order
  after insert on public.pos_order_items
  for each row execute function public.printwise_link_received_file_job_to_order();

drop trigger if exists trg_printwise_complete_received_file_job_after_payment on public.payment_transactions;
create trigger trg_printwise_complete_received_file_job_after_payment
  after insert or update of status, transaction_type, pos_order_id on public.payment_transactions
  for each row execute function public.printwise_complete_received_file_job_after_payment();

-- Remove the older duplicate completion trigger so only one payment workflow controls the status.
drop trigger if exists trg_complete_received_file_job_from_payment on public.payment_transactions;
