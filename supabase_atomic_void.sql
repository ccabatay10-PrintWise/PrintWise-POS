-- PrintWise atomic transaction void + inventory restoration
-- Apply supabase_inventory_control.sql and supabase_inventory_sales_control.sql first.

CREATE OR REPLACE FUNCTION public.void_printwise_pos_sale(
  p_order_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_status text;
  v_order_id uuid;
  v_restore jsonb;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = p_user_id
    AND COALESCE(is_active, true) = true;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Admin access is required to void transactions';
  END IF;

  SELECT id, status
    INTO v_order_id, v_status
  FROM public.pos_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Inventory restoration is idempotent, so retrying a void cannot double-stock.
  v_restore := public.restore_printwise_sale_inventory(p_order_id, p_user_id);

  IF lower(COALESCE(v_status, '')) = 'voided' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_voided', true,
      'inventory_restore', v_restore
    );
  END IF;

  UPDATE public.pos_orders
  SET status = 'voided'
  WHERE id = p_order_id;

  UPDATE public.payment_transactions
  SET status = 'voided'
  WHERE pos_order_id = p_order_id
    AND lower(COALESCE(status, '')) <> 'voided';

  RETURN jsonb_build_object(
    'ok', true,
    'already_voided', false,
    'inventory_restore', v_restore
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_printwise_pos_sale(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_printwise_pos_sale(uuid,uuid) TO authenticated;
