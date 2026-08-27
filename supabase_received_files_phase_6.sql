-- PrintWise Received Files - Phase 6
-- Completed job payment, POS and receipt tracking

alter table public.received_file_jobs
  add column if not exists pos_order_no text,
  add column if not exists payment_status text,
  add column if not exists payment_method text,
  add column if not exists amount_paid numeric(12,2),
  add column if not exists paid_at timestamptz,
  add column if not exists receipt_reference text;

update public.received_file_jobs
set payment_status = 'UNPAID'
where payment_status is null
   or payment_status not in ('UNPAID','PAID','VOIDED','REFUNDED');

alter table public.received_file_jobs
  alter column payment_status set default 'UNPAID',
  alter column payment_status set not null;

alter table public.received_file_jobs
  drop constraint if exists received_file_jobs_payment_status_check;

alter table public.received_file_jobs
  add constraint received_file_jobs_payment_status_check
  check (payment_status in ('UNPAID','PAID','VOIDED','REFUNDED'));

create index if not exists received_file_jobs_payment_status_idx
on public.received_file_jobs(payment_status);

create unique index if not exists received_file_jobs_pos_order_no_unique_idx
on public.received_file_jobs(pos_order_no)
where pos_order_no is not null;
