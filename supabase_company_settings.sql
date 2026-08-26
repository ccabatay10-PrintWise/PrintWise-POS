-- PRINTWISE COMPANY SETTINGS
-- Run once in Supabase SQL Editor while logged in as project owner.

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'PRINTWISE',
  tagline text not null default 'Printing & Customized Services',
  address text not null default '',
  contact_number text not null default '',
  email text not null default '',
  logo_url text not null default '',
  receipt_footer text not null default 'Thank you for choosing PRINTWISE!',
  currency text not null default 'PHP',
  receipt_paper_size text not null default '80mm' check (receipt_paper_size in ('58mm','80mm')),
  tax_enabled boolean not null default false,
  tax_rate numeric not null default 0,
  default_discount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

drop policy if exists "Authenticated users can view company settings" on public.company_settings;
create policy "Authenticated users can view company settings"
on public.company_settings for select to authenticated using (true);

drop policy if exists "Authenticated users can insert company settings" on public.company_settings;
create policy "Authenticated users can insert company settings"
on public.company_settings for insert to authenticated
with check (lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'admin')) = 'admin');

drop policy if exists "Authenticated admins can update company settings" on public.company_settings;
create policy "Authenticated admins can update company settings"
on public.company_settings for update to authenticated
using (lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'admin')) = 'admin')
with check (lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'admin')) = 'admin');
