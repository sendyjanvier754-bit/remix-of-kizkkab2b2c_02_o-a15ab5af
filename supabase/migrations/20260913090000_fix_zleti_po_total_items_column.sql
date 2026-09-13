-- Fix schema drift: some deployed databases are missing total_items on master_purchase_orders.
-- Required by the ZleTI manual PO function and harmless for existing Kizkka POs.

ALTER TABLE public.master_purchase_orders
  ADD COLUMN IF NOT EXISTS total_items integer NOT NULL DEFAULT 0;

ALTER TABLE public.master_purchase_orders
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.master_purchase_orders
SET total_items = 0
WHERE total_items IS NULL;
