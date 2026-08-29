create table if not exists public.smart_pricing_settings (
  id uuid primary key default gen_random_uuid(),
  business_id text not null default 'default',
  currency text not null default 'PHP',
  paper_a4_cost numeric not null default 0,
  paper_legal_cost numeric not null default 0,
  paper_letter_cost numeric not null default 0,
  paper_photo_cost numeric not null default 0,
  paper_sticker_cost numeric not null default 0,
  bw_light_rate numeric not null default 0,
  bw_medium_rate numeric not null default 0,
  bw_heavy_rate numeric not null default 0,
  color_light_rate numeric not null default 0,
  color_medium_rate numeric not null default 0,
  color_heavy_rate numeric not null default 0,
  machine_cost_per_page numeric not null default 0,
  labor_cost_per_job numeric not null default 0,
  waste_allowance_percent numeric not null default 0,
  markup_percent numeric not null default 0,
  minimum_job_price numeric not null default 0,
  round_to numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id)
);

alter table public.smart_pricing_settings enable row level security;

drop policy if exists "Authenticated users can view smart pricing settings" on public.smart_pricing_settings;
create policy "Authenticated users can view smart pricing settings"
  on public.smart_pricing_settings for select to authenticated using (true);

drop policy if exists "Authenticated users can manage smart pricing settings" on public.smart_pricing_settings;
create policy "Authenticated users can manage smart pricing settings"
  on public.smart_pricing_settings for all to authenticated using (true) with check (true);

insert into public.smart_pricing_settings (business_id)
values ('default')
on conflict (business_id) do nothing;
