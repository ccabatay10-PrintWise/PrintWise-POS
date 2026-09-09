-- WISE POS product catalog controls.
-- Products remain in the database; show_in_pos controls whether they appear in checkout.
-- Existing products stay hidden so the POS remains clean after the migration.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_pos boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT false;

UPDATE public.products
SET show_in_pos = false
WHERE show_in_pos IS NULL OR show_in_pos = true;

CREATE INDEX IF NOT EXISTS products_show_in_pos_active_idx
  ON public.products(is_active, show_in_pos);
