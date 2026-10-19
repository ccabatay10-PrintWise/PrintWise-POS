-- ESPACIO payroll foundation: employee records, attendance, incentive settings and payroll audit tables.
-- Apply only after reviewing this migration in the preview branch.

create table if not exists public.payroll_employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  position_title text not null,
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.payroll_employees(id) on delete restrict,
  work_date date not null,
  attendance_status text not null default 'present'
    check (attendance_status in ('present','absent','rest_day','leave','half_day')),
  time_in time,
  time_out time,
  notes text,
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create table if not exists public.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'ESPACIO Café & Restaurant',
  sales_threshold numeric(12,2) not null default 3000 check (sales_threshold > 0),
  incentive_per_threshold numeric(12,2) not null default 100 check (incentive_per_threshold >= 0),
  incentive_distribution text not null default 'equal'
    check (incentive_distribution in ('equal')),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft','reviewed','approved','paid')),
  total_basic_pay numeric(12,2) not null default 0,
  total_incentives numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  total_net_pay numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.payroll_employees(id) on delete restrict,
  days_worked numeric(6,2) not null default 0,
  daily_rate numeric(12,2) not null default 0,
  basic_pay numeric(12,2) not null default 0,
  incentive_share numeric(12,2) not null default 0,
  additions numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique(payroll_run_id, employee_id)
);

create index if not exists payroll_attendance_work_date_idx on public.payroll_attendance(work_date);
create index if not exists payroll_items_employee_idx on public.payroll_items(employee_id);

alter table public.payroll_employees enable row level security;
alter table public.payroll_attendance enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists "Payroll admins manage employees" on public.payroll_employees;
create policy "Payroll admins manage employees" on public.payroll_employees
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true));

drop policy if exists "Payroll admins manage attendance" on public.payroll_attendance;
create policy "Payroll admins manage attendance" on public.payroll_attendance
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true));

drop policy if exists "Payroll admins manage settings" on public.payroll_settings;
create policy "Payroll admins manage settings" on public.payroll_settings
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true));

drop policy if exists "Payroll admins manage runs" on public.payroll_runs;
create policy "Payroll admins manage runs" on public.payroll_runs
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true));

drop policy if exists "Payroll admins manage items" on public.payroll_items;
create policy "Payroll admins manage items" on public.payroll_items
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true));

grant select, insert, update, delete on public.payroll_employees, public.payroll_attendance, public.payroll_settings, public.payroll_runs, public.payroll_items to authenticated;

insert into public.payroll_settings (business_name, sales_threshold, incentive_per_threshold, incentive_distribution)
select 'ESPACIO Café & Restaurant', 3000, 100, 'equal'
where not exists (select 1 from public.payroll_settings);
