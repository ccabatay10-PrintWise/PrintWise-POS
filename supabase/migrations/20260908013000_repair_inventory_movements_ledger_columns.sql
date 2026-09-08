-- Repair legacy inventory_movements tables that already existed before the
-- atomic POS migration. CREATE TABLE IF NOT EXISTS does not add missing columns
-- to an existing table, so explicitly add the ledger columns required by the
-- POS checkout, adjustment, and void-restoration functions.

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS quantity_before numeric,
  ADD COLUMN IF NOT EXISTS quantity_after numeric,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx
  ON public.inventory_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS inventory_movements_inventory_item_idx
  ON public.inventory_movements(inventory_item_id);
