-- PrintWise Received Files - Phase 1
-- Customer QR upload + multiple files + staff intake list

create extension if not exists pgcrypto;

create table if not exists public.received_file_jobs (
  id uuid primary key default gen_random_uuid(),
  reference_no text unique not null,
  customer_name text not null,
  contact_number text not null,
  status text not null default 'RECEIVED',
  file_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.received_file_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.received_file_jobs(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists received_file_jobs_created_at_idx on public.received_file_jobs(created_at desc);
create index if not exists received_file_items_job_id_idx on public.received_file_items(job_id);

alter table public.received_file_jobs enable row level security;
alter table public.received_file_items enable row level security;

create policy "received_file_jobs_insert" on public.received_file_jobs
for insert to anon, authenticated with check (true);

create policy "received_file_jobs_select" on public.received_file_jobs
for select to authenticated using (true);

create policy "received_file_jobs_update" on public.received_file_jobs
for update to authenticated using (true) with check (true);

create policy "received_file_items_insert" on public.received_file_items
for insert to anon, authenticated with check (true);

create policy "received_file_items_select" on public.received_file_items
for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('received-files', 'received-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy "received_files_public_insert" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'received-files');

create policy "received_files_authenticated_select" on storage.objects
for select to authenticated
using (bucket_id = 'received-files');
