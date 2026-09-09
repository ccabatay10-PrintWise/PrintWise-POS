-- WISE POS core checkout
-- General-purpose POS engine. Inventory is optional per item:
-- a sale can complete for services/non-stock products, while mapped stock items
-- are deducted atomically when an active inventory mapping exists.

CREATE OR REPLACE FUNCTION public.wise_user_can_checkout(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND COALESCE(p.is_active, true) = true
      AND lower(COALESCE(p.role::text, '')) IN ('admin', 'staff', 'cashier')
  );
$$;

REVOKE ALL ON FUNCTION public.wise_user_can_checkout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wise_user_can_checkout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_wise_pos_sale(
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
SET search_path = ''
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

  IF NOT public.wise_user_can_checkout(auth.uid()) THEN
    RAISE EXCEPTION 'POS checkout is not permitted for this account';
  END IF;

  IF NULLIF(trim(COALESCE(p_order_no, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Order number is required';
  END IF;
  IF NULLIF(trim(COALESCE(p_transaction_no, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Transaction number is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  IF COALESCE(p_subtotal, 0) < 0 OR COALESCE(p_discount_amount, 0) < 0
     OR COALESCE(p_total, 0) < 0 OR COALESCE(p_amount_paid, 0) < 0 THEN
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
    NULLIF(trim(COALESCE(p_customer_name, '')), ''),
    'completed',
    COALESCE(p_subtotal, 0),
    NULLIF(trim(COALESCE(p_discount_type, '')), ''),
    COALESCE(p_discount_value, 0),
    COALESCE(p_discount_amount, 0),
    COALESCE(p_total, 0),
    COALESCE(p_amount_paid, 0),
    GREATEST(0, COALESCE(p_total, 0) - COALESCE(p_amount_paid, 0)),
    p_created_by
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NULLIF(trim(COALESCE(v_item->>'item_name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'An order item is missing its name';
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Order item quantity must be greater than zero';
    END IF;
    IF COALESCE((v_item->>'unit_price')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Order item price cannot be negative';
    END IF;

    v_product_id := NULLIF(trim(COALESCE(v_item->>'product_id', '')), '')::uuid;
    v_inventory_id := NULL;
    v_before := NULL;

    -- Inventory is optional. A product/service remains sellable without a
    -- stock mapping. If a mapping exists, stock is checked and deducted.
    IF v_product_id IS NOT NULL THEN
      SELECT ii.id, ii.quantity
      INTO v_inventory_id, v_before
      FROM public.inventory_items ii
      WHERE ii.product_id = v_product_id
        AND COALESCE(ii.is_active, true) = true
      FOR UPDATE;

      IF v_inventory_id IS NOT NULL THEN
        IF v_before < v_quantity THEN
          RAISE EXCEPTION 'Insufficient inventory for product %: available %, required %', v_product_id, v_before, v_quantity;
        END IF;

        v_after := v_before - v_quantity;

        UPDATE public.inventory_items
        SET quantity = v_after,
            updated_at = now()
        WHERE id = v_inventory_id;
      END IF;
    END IF;

    INSERT INTO public.pos_order_items (
      pos_order_id, product_id, item_name, unit_price, quantity, line_total
    ) VALUES (
      v_order_id,
      v_product_id,
      trim(v_item->>'item_name'),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      v_quantity,
      COALESCE((v_item->>'line_total')::numeric, 0)
    );

    IF v_inventory_id IS NOT NULL THEN
      INSERT INTO public.inventory_movements (
        inventory_item_id, movement_type, quantity, quantity_before, quantity_after,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_inventory_id, 'sale', -v_quantity, v_before, v_after,
        'wise_pos_order', v_order_id, 'WISE POS sale inventory deduction', p_created_by
      );
      v_inventory_movements := v_inventory_movements + 1;
    END IF;
  END LOOP;

  INSERT INTO public.payment_transactions (
    transaction_no, pos_order_id, channel, transaction_type, amount,
    service_fee, customer_name, status, created_by
  ) VALUES (
    trim(p_transaction_no), v_order_id, lower(trim(p_payment_channel)), 'payment',
    COALESCE(p_total, 0), 0,
    NULLIF(trim(COALESCE(p_customer_name, '')), ''), 'successful', p_created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'inventory_movement_count', v_inventory_movements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_wise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_wise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) TO authenticated;
