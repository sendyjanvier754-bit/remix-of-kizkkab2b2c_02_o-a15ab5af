-- Fix: Add missing country_code column to master_purchase_orders
-- The get_or_create_market_po function (used in close_market_po_and_open_next)
-- inserts country_code but the column was never added in migration 20260303161150.
-- This causes a 400 Bad Request when trying to close a PO.

ALTER TABLE public.master_purchase_orders
  ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Backfill country_code from the linked market for existing POs
UPDATE public.master_purchase_orders mpo
SET country_code = m.code
FROM public.markets m
WHERE mpo.market_id = m.id
  AND mpo.country_code IS NULL;
