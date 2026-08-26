-- PrintWise Inventory Database Fix
-- Run this entire file once in the Supabase SQL Editor.

-- 1. Create the table if it does not exist.
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  quantity numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add any columns missing from older versions of the table.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Backfill null values from older records.
UPDATE public.inventory_items
SET
  unit = COALESCE(NULLIF(unit, ''), 'piece'),
  quantity = COALESCE(quantity, 0),
  reorder_level = COALESCE(reorder_level, 0),
  unit_cost = COALESCE(unit_cost, 0),
  is_active = COALESCE(is_active, true);

-- 4. Keep numeric values valid.
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_quantity_nonnegative,
  DROP CONSTRAINT IF EXISTS inventory_items_reorder_level_nonnegative,
  DROP CONSTRAINT IF EXISTS inventory_items_unit_cost_nonnegative;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_quantity_nonnegative CHECK (quantity >= 0),
  ADD CONSTRAINT inventory_items_reorder_level_nonnegative CHECK (reorder_level >= 0),
  ADD CONSTRAINT inventory_items_unit_cost_nonnegative CHECK (unit_cost >= 0);

-- 5. Ensure authenticated PrintWise users can read and manage inventory.
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory_items;

CREATE POLICY "Authenticated users can view inventory"
ON public.inventory_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert inventory"
ON public.inventory_items FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
ON public.inventory_items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory"
ON public.inventory_items FOR DELETE
TO authenticated
USING (true);
