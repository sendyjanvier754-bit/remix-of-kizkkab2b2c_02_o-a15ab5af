-- Fix schema drift: some deployed databases are missing created_by on master_purchase_orders.
-- This is nullable so existing Kizkka records remain unchanged.

ALTER TABLE public.master_purchase_orders
  ADD COLUMN IF NOT EXISTS created_by uuid;
