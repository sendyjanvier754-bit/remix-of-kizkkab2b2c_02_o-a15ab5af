
-- Fix PO-CB-005 totals to match actual orders
DO $$
BEGIN
  UPDATE master_purchase_orders
  SET total_amount = 381.61,
      total_quantity = 13,
      updated_at = now()
  WHERE id = '53151c81-61ab-4f6c-a8a7-2af8d1a7dc1d';
END $$;
