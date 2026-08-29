-- PrintWise Smart Pricing History & Audit Trail upgrade
-- Run this once in the Supabase SQL Editor.

alter table if exists public.smart_pricing_approvals
  add column if not exists approved_by_name text,
  add column if not exists approved_by_user_id uuid;

-- Keep approval records readable by authenticated PrintWise users.
alter table public.smart_pricing_approvals enable row level security;

drop policy if exists "Authenticated users can view smart pricing approvals" on public.smart_pricing_approvals;
create policy "Authenticated users can view smart pricing approvals"
  on public.smart_pricing_approvals
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create smart pricing approvals" on public.smart_pricing_approvals;
create policy "Authenticated users can create smart pricing approvals"
  on public.smart_pricing_approvals
  for insert
  to authenticated
  with check (true);
