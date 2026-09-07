-- PrintWise production migration: atomic POS checkout, inventory control, and void restoration.
-- This migration is intentionally self-contained so the POS sale/void functions and
-- inventory ledger use the same schema.

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  quantity_before numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Authenticated users can view inventory movements"
ON public.inventory_movements FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE INDEX IF NOT EXISTS inventory_items_product_id_idx
  ON public.inventory_items(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_product_id_unique_idx
  ON public.inventory_items(product_id)
  WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.adjust_printwise_inventory(
  p_item_id uuid,
  p_delta numeric,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_role text;
  v_before numeric;
  v_after numeric;
BEGIN
  IF v_user_id IS NULL OR auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND COALESCE(is_active, true) = true;

  IF v_role NOT IN ('admin','staff','cashier') THEN
    RAISE EXCEPTION 'Inventory adjustment permission denied';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Inventory adjustment cannot be zero';
  END IF;

  IF NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Inventory adjustment reason is required';
  END IF;

  SELECT quantity INTO v_before
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  v_after := v_before + p_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  UPDATE public.inventory_items
  SET quantity = v_after,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_movements (
    inventory_item_id, movement_type, quantity, quantity_before, quantity_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    p_item_id,
    CASE WHEN p_delta > 0 THEN 'adjustment_in' ELSE 'adjustment_out' END,
    p_delta,
    v_before,
    v_after,
    NULLIF(trim(COALESCE(p_reference_type, '')), ''),
    p_reference_id,
    trim(p_reason),
    v_user_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'quantity_before', v_before,
    'quantity_after', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_printwise_inventory(uuid,numeric,text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_printwise_inventory(uuid,numeric,text,text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.printwise_user_can_pos_checkout(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND COALESCE(p.is_active, true) = true
      AND lower(COALESCE(p.role, '')) IN ('admin','staff','cashier')
  );
$$;

REVOKE ALL ON FUNCTION public.printwise_user_can_pos_checkout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.printwise_user_can_pos_checkout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_printwise_pos_sale(
  p_order_no text,
  p_customer_name text,
  p_subtotal numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_amount_paid numeric,
  p_created_by uuid,
  p_payment_channel text,
  p_transaction_no text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_inventory_id uuid;
  v_before numeric;
  v_after numeric;
  v_inventory_movements integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_created_by THEN
    RAISE EXCEPTION 'Unauthorized checkout request';
  END IF;
  IF NOT public.printwise_user_can_pos_checkout(auth.uid()) THEN
    RAISE EXCEPTION 'POS checkout is not permitted for this account';
  END IF;
  IF NULLIF(trim(COALESCE(p_order_no,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Order number is required';
  END IF;
  IF NULLIF(trim(COALESCE(p_transaction_no,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Transaction number is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  IF COALESCE(p_subtotal,0) < 0 OR COALESCE(p_discount_amount,0) < 0
     OR COALESCE(p_total,0) < 0 OR COALESCE(p_amount_paid,0) < 0 THEN
    RAISE EXCEPTION 'Invalid sale amounts';
  END IF;
  IF p_total > p_amount_paid THEN
    RAISE EXCEPTION 'Amount paid is not enough';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pos_orders WHERE order_no = trim(p_order_no)) THEN
    RAISE EXCEPTION 'Order number already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE transaction_no = trim(p_transaction_no)) THEN
    RAISE EXCEPTION 'Transaction number already exists';
  END IF;

  INSERT INTO public.pos_orders (
    order_no, customer_name, status, subtotal, discount_type, discount_value,
    discount_amount, total, amount_paid, balance, created_by
  ) VALUES (
    trim(p_order_no),
    NULLIF(trim(COALESCE(p_customer_name,'')), ''),
    'completed',
    COALESCE(p_subtotal,0),
    NULLIF(trim(COALESCE(p_discount_type,'')), ''),
    COALESCE(p_discount_value,0),
    COALESCE(p_discount_amount,0),
    COALESCE(p_total,0),
    COALESCE(p_amount_paid,0),
    GREATEST(0, COALESCE(p_total,0) - COALESCE(p_amount_paid,0)),
    p_created_by
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NULLIF(trim(COALESCE(v_item->>'item_name','')), '') IS NULL THEN
      RAISE EXCEPTION 'An order item is missing its name';
    END IF;
    IF COALESCE((v_item->>'quantity')::numeric,0) <= 0 THEN
      RAISE EXCEPTION 'Order item quantity must be greater than zero';
    END IF;
    IF COALESCE((v_item->>'unit_price')::numeric,0) < 0 THEN
      RAISE EXCEPTION 'Order item price cannot be negative';
    END IF;

    v_product_id := NULLIF(trim(v_item->>'product_id'), '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Product mapping is required for inventory-controlled POS items';
    END IF;

    SELECT id, quantity
      INTO v_inventory_id, v_before
    FROM public.inventory_items
    WHERE product_id = v_product_id
      AND COALESCE(is_active, true) = true
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'No active inventory mapping exists for product %', v_product_id;
    END IF;

    IF v_before < v_quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for product %: available %, required %', v_product_id, v_before, v_quantity;
    END IF;

    v_after := v_before - v_quantity;

    UPDATE public.inventory_items
    SET quantity = v_after,
        updated_at = now()
    WHERE id = v_inventory_id;

    INSERT INTO public.pos_order_items (
      pos_order_id, product_id, item_name, unit_price, quantity, line_total
    ) VALUES (
      v_order_id,
      v_product_id,
      trim(v_item->>'item_name'),
      COALESCE((v_item->>'unit_price')::numeric,0),
      v_quantity,
      COALESCE((v_item->>'line_total')::numeric,0)
    );

    INSERT INTO public.inventory_movements (
      inventory_item_id, movement_type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_inventory_id, 'sale', -v_quantity, v_before, v_after,
      'pos_order', v_order_id, 'POS sale inventory deduction', p_created_by
    );

    v_inventory_movements := v_inventory_movements + 1;
  END LOOP;

  INSERT INTO public.payment_transactions (
    transaction_no, pos_order_id, channel, transaction_type, amount,
    service_fee, customer_name, status, created_by
  ) VALUES (
    trim(p_transaction_no), v_order_id, lower(trim(p_payment_channel)), 'payment',
    COALESCE(p_total,0), 0,
    NULLIF(trim(COALESCE(p_customer_name,'')), ''), 'successful', p_created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'inventory_movement_count', v_inventory_movements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_printwise_sale_inventory(
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
  v_movement record;
  v_before numeric;
  v_after numeric;
  v_restored integer := 0;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = p_user_id AND COALESCE(is_active, true) = true;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Admin access is required to restore inventory for a voided transaction';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_type = 'pos_order_void_restore'
      AND reference_id = p_order_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_restored', true);
  END IF;

  FOR v_movement IN
    SELECT im.*
    FROM public.inventory_movements im
    WHERE im.reference_type = 'pos_order'
      AND im.reference_id = p_order_id
      AND im.movement_type = 'sale'
    ORDER BY im.created_at
  LOOP
    SELECT quantity INTO v_before
    FROM public.inventory_items
    WHERE id = v_movement.inventory_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item for void restoration was not found';
    END IF;

    v_after := v_before + abs(v_movement.quantity);

    UPDATE public.inventory_items
    SET quantity = v_after,
        updated_at = now()
    WHERE id = v_movement.inventory_item_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id, movement_type, quantity, quantity_before, quantity_after,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_movement.inventory_item_id, 'sale_void_restore', abs(v_movement.quantity),
      v_before, v_after, 'pos_order_void_restore', p_order_id,
      'Inventory restored after POS transaction void', p_user_id
    );

    v_restored := v_restored + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'already_restored', false, 'movement_count', v_restored);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_printwise_sale_inventory(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_printwise_sale_inventory(uuid, uuid) TO authenticated;

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
  v_restore jsonb;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = p_user_id AND COALESCE(is_active, true) = true;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Admin access is required to void transactions';
  END IF;

  SELECT status INTO v_status
  FROM public.pos_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF lower(COALESCE(v_status, '')) = 'voided' THEN
    RETURN jsonb_build_object('ok', true, 'already_voided', true);
  END IF;

  v_restore := public.restore_printwise_sale_inventory(p_order_id, p_user_id);

  UPDATE public.pos_orders
  SET status = 'voided'
  WHERE id = p_order_id;

  UPDATE public.payment_transactions
  SET status = 'voided'
  WHERE pos_order_id = p_order_id
    AND lower(COALESCE(status, '')) <> 'voided';

  RETURN jsonb_build_object('ok', true, 'already_voided', false, 'inventory_restore', v_restore);
END;
$$;

REVOKE ALL ON FUNCTION public.void_printwise_pos_sale(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_printwise_pos_sale(uuid,uuid) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_order_no_unique_idx
  ON public.pos_orders(order_no);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_transaction_no_unique_idx
  ON public.payment_transactions(transaction_no);
