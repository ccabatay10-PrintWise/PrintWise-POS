-- PrintWise Inventory Control
-- Adds an auditable, atomic stock-adjustment path.
-- NOTE: Apply this migration in Supabase when project write permissions are available.

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_delta numeric NOT NULL,
  quantity_before numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Authenticated users can view inventory movements"
ON public.inventory_movements FOR SELECT
TO authenticated
USING (true);

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

  SELECT role::text INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND COALESCE(is_active, true) = true;

  IF v_role IS NULL OR v_role NOT IN ('admin','staff','cashier') THEN
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
    inventory_item_id, quantity_delta, quantity_before, quantity_after,
    reason, reference_type, reference_id, created_by
  ) VALUES (
    p_item_id, p_delta, v_before, v_after,
    trim(p_reason), NULLIF(trim(COALESCE(p_reference_type, '')), ''),
    p_reference_id, v_user_id
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
