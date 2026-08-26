-- Run this once in Supabase SQL Editor
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

-- Optional: prevent negative unit costs
ALTER TABLE public.inventory_items
DROP CONSTRAINT IF EXISTS inventory_items_unit_cost_nonnegative;
ALTER TABLE public.inventory_items
ADD CONSTRAINT inventory_items_unit_cost_nonnegative CHECK (unit_cost >= 0);
