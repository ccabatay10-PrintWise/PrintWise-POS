-- WISE POS explicitly distinguishes products from services.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'product';

UPDATE public.products
SET item_type = 'product'
WHERE item_type IS NULL OR item_type NOT IN ('product', 'service');

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_item_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_item_type_check
  CHECK (item_type IN ('product', 'service'));

CREATE INDEX IF NOT EXISTS products_item_type_pos_idx
  ON public.products(item_type, is_active, show_in_pos);
