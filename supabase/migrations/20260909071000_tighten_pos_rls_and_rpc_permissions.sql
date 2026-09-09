-- Internal/trigger-only functions must not be exposed through PostgREST.
REVOKE EXECUTE ON FUNCTION public.complete_received_file_job_from_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_printwise_status_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_complete_received_file_job_after_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_link_received_file_job_to_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_normalize_pos_payment_amount() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_recalculate_pos_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_sync_pos_order_from_item() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.printwise_sync_pos_order_from_payment() FROM PUBLIC, anon, authenticated;

-- Consolidate POS-order policies. Cashiers/staff can create and view; only admins can update/delete.
DROP POLICY IF EXISTS "pos_orders_staff_all" ON public.pos_orders;
DROP POLICY IF EXISTS "Admin and Staff can create orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Admin and Staff can view orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Only Admin can update orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Only Admin can delete orders" ON public.pos_orders;

CREATE POLICY "POS staff can create orders" ON public.pos_orders FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active=true AND lower(p.role)=ANY(ARRAY['admin','cashier','staff'])));
CREATE POLICY "POS staff can view orders" ON public.pos_orders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active=true AND lower(p.role)=ANY(ARRAY['admin','cashier','staff'])));
CREATE POLICY "POS admins can update orders" ON public.pos_orders FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active=true AND lower(p.role)='admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active=true AND lower(p.role)='admin'));
CREATE POLICY "POS admins can delete orders" ON public.pos_orders FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active=true AND lower(p.role)='admin'));

DROP POLICY IF EXISTS "smart_pricing_approvals_insert" ON public.smart_pricing_approvals;
DROP POLICY IF EXISTS "smart_pricing_approvals_select" ON public.smart_pricing_approvals;
DROP INDEX IF EXISTS public.idx_inventory_movements_reference;
