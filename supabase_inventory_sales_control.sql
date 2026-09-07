-- PrintWise: inventory mapping + atomic sale stock movement foundation
-- Apply this migration in Supabase SQL Editor / migration runner before enabling stock deduction.

-- Explicitly map inventory records to sellable products.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE INDEX IF NOT EXISTS inventory_items_product_id_idx
  ON public.inventory_items(product_id);

-- One inventory record per product is required for deterministic POS deduction.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_product_id_unique_idx
  ON public.inventory_items(product_id)
  WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deduct_printwise_sale_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_inventory_id uuid;
  v_before numeric;
  v_after numeric;
  v_movement_count integer := 0;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = p_user_id
    AND coalesce(is_active, true) = true;

  IF v_role NOT IN ('admin', 'staff', 'cashier') THEN
    RAISE EXCEPTION 'POS inventory deduction is not permitted for this account';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(trim(v_item->>'product_id'), '')::uuid;
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, quantity
      INTO v_inventory_id, v_before
    FROM public.inventory_items
    WHERE product_id = v_product_id
      AND coalesce(is_active, true) = true
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'No active inventory mapping exists for product %', v_product_id;
    END IF;

    IF v_before < v_quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for product %: available %, required %', v_product_id, v_before, v_quantity;
    END IF;

    v_after := v_before - v_quantity;

    UPDATE public.inventory_items
    SET quantity = v_after
    WHERE id = v_inventory_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      v_inventory_id,
      'sale',
      -v_quantity,
      v_before,
      v_after,
      'pos_order',
      p_order_id,
      'POS sale inventory deduction',
      p_user_id
    );

    v_movement_count := v_movement_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'movement_count', v_movement_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_printwise_sale_inventory(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_printwise_sale_inventory(uuid, jsonb, uuid) TO authenticated;

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
  v_restored integer := 0;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(coalesce(role::text, '')))
    INTO v_role
  FROM public.profiles
  WHERE id = p_user_id
    AND coalesce(is_active, true) = true;

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
    UPDATE public.inventory_items ii
    SET quantity = ii.quantity + abs(v_movement.quantity)
    WHERE ii.id = v_movement.inventory_item_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT
      ii.id,
      'sale_void_restore',
      abs(v_movement.quantity),
      ii.quantity - abs(v_movement.quantity),
      ii.quantity,
      'pos_order_void_restore',
      p_order_id,
      'Inventory restored after POS transaction void',
      p_user_id
    FROM public.inventory_items ii
    WHERE ii.id = v_movement.inventory_item_id;

    v_restored := v_restored + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'already_restored', false, 'movement_count', v_restored);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_printwise_sale_inventory(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_printwise_sale_inventory(uuid, uuid) TO authenticated;
