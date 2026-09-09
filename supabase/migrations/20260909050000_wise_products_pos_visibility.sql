-- WISE POS product catalog controls.
-- Products remain in the database; show_in_pos controls whether they appear in checkout.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_pos boolean NOT NULL DEFAULT true;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_show_in_pos_active_idx
  ON public.products(is_active, show_in_pos);
