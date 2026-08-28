-- PrintWise Received Files - Email migration
-- Replaces the required customer contact number with email support.

alter table public.received_file_jobs
  add column if not exists email text;

alter table public.received_file_jobs
  alter column contact_number drop not null;

create index if not exists received_file_jobs_email_idx
on public.received_file_jobs(email);
