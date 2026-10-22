alter table public.payroll_employees add column if not exists contact_number text;
alter table public.payroll_attendance
  add column if not exists overtime_hours numeric not null default 0 check (overtime_hours >= 0),
  add column if not exists cash_advance numeric not null default 0 check (cash_advance >= 0),
  add column if not exists other_deduction numeric not null default 0 check (other_deduction >= 0),
  add column if not exists approval_notes text;
alter table public.payroll_items
  add column if not exists present_days numeric not null default 0,
  add column if not exists half_days numeric not null default 0,
  add column if not exists paid_leave_days numeric not null default 0,
  add column if not exists overtime_hours numeric not null default 0,
  add column if not exists overtime_pay numeric not null default 0,
  add column if not exists cash_advance numeric not null default 0,
  add column if not exists other_deduction numeric not null default 0;
alter table public.payroll_runs add column if not exists total_overtime_pay numeric not null default 0;
