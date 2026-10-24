-- ESPACIO loyalty members and one-stamp-per-transaction program
create table if not exists public.loyalty_members (
  id uuid primary key default gen_random_uuid(),
  loyalty_no text unique not null,
  full_name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  is_active boolean not null default true,
  stamps integer not null default 0 check (stamps >= 0 and stamps <= 8),
  free_drinks_redeemed integer not null default 0 check (free_drinks_redeemed >= 0)
);

create unique index if not exists loyalty_members_phone_unique on public.loyalty_members (regexp_replace(phone, '[^0-9]', '', 'g'));
create table if not exists public.loyalty_stamps (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.loyalty_members(id),
  pos_order_id uuid not null references public.pos_orders(id),
  order_no text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(pos_order_id)
);

alter table public.loyalty_members enable row level security;
alter table public.loyalty_stamps enable row level security;
revoke all on public.loyalty_members from anon, authenticated;
revoke all on public.loyalty_stamps from anon, authenticated;

create or replace function public.award_loyalty_stamp(p_order_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.pos_orders%rowtype;
  v_member public.loyalty_members%rowtype;
  v_stamps integer;
  v_redeemed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.pos_orders where id = p_order_id;
  if not found then raise exception 'Sale not found'; end if;
  if v_order.created_by <> auth.uid() and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and lower(p.role::text) = 'admin' and coalesce(p.is_active,true)
  ) then raise exception 'Not permitted to award loyalty stamps for this sale'; end if;
  select * into v_member from public.loyalty_members where id = p_member_id and is_active for update;
  if not found then raise exception 'Active loyalty member not found'; end if;
  if exists(select 1 from public.loyalty_stamps where pos_order_id = p_order_id) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'stamps', v_member.stamps, 'free_drinks_redeemed', v_member.free_drinks_redeemed);
  end if;
  insert into public.loyalty_stamps(member_id,pos_order_id,order_no,created_by)
  values(p_member_id,p_order_id,v_order.order_no,auth.uid());
  v_stamps := v_member.stamps + 1;
  if v_stamps >= 9 then
    v_stamps := 0;
    v_redeemed := true;
    update public.loyalty_members set stamps = 0, free_drinks_redeemed = free_drinks_redeemed + 1 where id = p_member_id;
  else
    update public.loyalty_members set stamps = v_stamps where id = p_member_id;
  end if;
  return jsonb_build_object('ok',true,'stamps',v_stamps,'free_drink_earned',v_redeemed);
end;
$$;

revoke all on function public.award_loyalty_stamp(uuid,uuid) from public;
grant execute on function public.award_loyalty_stamp(uuid,uuid) to authenticated;
