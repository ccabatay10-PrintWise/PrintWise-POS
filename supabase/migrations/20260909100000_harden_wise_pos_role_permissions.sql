-- WISE POS role hardening applied to production.
-- Profiles: users must not be able to modify their own role/status.
drop policy if exists profiles_update_self on public.profiles;

-- Products: cashier can view; admin/staff manage catalog.
drop policy if exists products_staff_all on public.products;
create policy products_staff_select on public.products for select to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy products_admin_staff_insert on public.products for insert to authenticated with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));
create policy products_admin_staff_update on public.products for update to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff']))) with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));
create policy products_admin_staff_delete on public.products for delete to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));

-- Inventory: cashier can view; admin/staff manage inventory records.
drop policy if exists inventory_staff_all on public.inventory_items;
create policy inventory_staff_select on public.inventory_items for select to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy inventory_admin_staff_insert on public.inventory_items for insert to authenticated with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));
create policy inventory_admin_staff_update on public.inventory_items for update to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff']))) with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));
create policy inventory_admin_staff_delete on public.inventory_items for delete to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','staff'])));

-- Payments: operational users can select/insert/update; only admin can delete.
drop policy if exists payments_staff_all on public.payment_transactions;
create policy payments_staff_select on public.payment_transactions for select to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy payments_staff_insert on public.payment_transactions for insert to authenticated with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy payments_staff_update on public.payment_transactions for update to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff']))) with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy payments_admin_delete on public.payment_transactions for delete to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)='admin'));

-- POS orders: active admin/cashier/staff can create/view; only admin can update/delete.
drop policy if exists "Admin and Staff can create orders" on public.pos_orders;
drop policy if exists "Admin and Staff can view orders" on public.pos_orders;
drop policy if exists "Only Admin can update orders" on public.pos_orders;
drop policy if exists "Only Admin can delete orders" on public.pos_orders;
drop policy if exists pos_orders_staff_all on public.pos_orders;
create policy pos_orders_staff_insert on public.pos_orders for insert to authenticated with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy pos_orders_staff_select on public.pos_orders for select to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)=any(array['admin','cashier','staff'])));
create policy pos_orders_admin_update on public.pos_orders for update to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)='admin')) with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)='admin'));
create policy pos_orders_admin_delete on public.pos_orders for delete to authenticated using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and lower(p.role)='admin'));
