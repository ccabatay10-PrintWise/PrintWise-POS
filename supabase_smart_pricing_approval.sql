-- PrintWise Smart Pricing Approval Workflow
-- Stores the original Smart Suggested Price and the staff-approved final price.

create table if not exists public.smart_pricing_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.received_file_jobs(id) on delete cascade,
  file_id uuid not null references public.received_file_items(id) on delete cascade,
  suggested_price numeric(12,2) not null,
  final_price numeric(12,2) not null,
  copies integer not null default 1 check (copies > 0),
  adjustment_reason text,
  staff_notes text,
  status text not null default 'APPROVED',
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists smart_pricing_approvals_job_id_idx
  on public.smart_pricing_approvals(job_id, approved_at desc);

create index if not exists smart_pricing_approvals_file_id_idx
  on public.smart_pricing_approvals(file_id, approved_at desc);

alter table public.smart_pricing_approvals enable row level security;

drop policy if exists "smart_pricing_approvals_select" on public.smart_pricing_approvals;
drop policy if exists "smart_pricing_approvals_insert" on public.smart_pricing_approvals;

create policy "smart_pricing_approvals_select"
  on public.smart_pricing_approvals
  for select to authenticated using (true);

create policy "smart_pricing_approvals_insert"
  on public.smart_pricing_approvals
  for insert to authenticated with check (true);
