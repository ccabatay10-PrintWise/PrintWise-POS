-- Extend ESPACIO payroll settings to mirror the offline payroll configuration.
alter table public.payroll_settings
  add column if not exists standard_hours_per_day numeric(5,2) not null default 8 check (standard_hours_per_day > 0 and standard_hours_per_day <= 24),
  add column if not exists overtime_multiplier numeric(5,2) not null default 1.25 check (overtime_multiplier >= 1 and overtime_multiplier <= 3),
  add column if not exists payroll_frequency text not null default 'semi_monthly' check (payroll_frequency in ('weekly','semi_monthly','monthly')),
  add column if not exists paid_leave_enabled boolean not null default true;
