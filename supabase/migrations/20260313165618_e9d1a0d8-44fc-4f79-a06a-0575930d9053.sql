
-- Data fix: Move orphaned order from PO-CB-004 to PO-CB-005
-- and recalculate totals for both POs

DO $$
DECLARE
  v_po4_id UUID := '608259b4-9c6f-4465-a8db-9ec018c5a109';
  v_po5_id UUID := '53151c81-61ab-4f6c-a8a7-2af8d1a7dc1d';
  v_order_id UUID := '90a31c1f-fff9-40a7-8730-9ab84a746d77';
  v_order_amount NUMERIC;
  v_order_qty INT;
BEGIN
  -- Get order details
  SELECT total_amount, total_quantity INTO v_order_amount, v_order_qty
  FROM orders_b2b WHERE id = v_order_id;

  -- Move order to PO-CB-005
  UPDATE orders_b2b 
  SET master_po_id = v_po5_id,
      po_linked_at = now(),
      updated_at = now()
  WHERE id = v_order_id;

  -- Also add po_order_links entry
  INSERT INTO po_order_links (po_id, order_id, order_type)
  VALUES (v_po5_id, v_order_id, 'b2b')
  ON CONFLICT DO NOTHING;

  -- Remove old link if exists
  DELETE FROM po_order_links WHERE po_id = v_po4_id AND order_id = v_order_id;

  -- Update PO-CB-004 totals (subtract moved order)
  UPDATE master_purchase_orders
  SET total_amount = GREATEST(0, total_amount - v_order_amount),
      total_quantity = GREATEST(0, total_quantity - v_order_qty),
      updated_at = now()
  WHERE id = v_po4_id;

  -- Update PO-CB-005 totals (add moved order)
  UPDATE master_purchase_orders
  SET total_amount = COALESCE(total_amount, 0) + v_order_amount,
      total_quantity = COALESCE(total_quantity, 0) + v_order_qty,
      updated_at = now()
  WHERE id = v_po5_id;

  RAISE NOTICE 'Moved order % ($%, % items) from PO-CB-004 to PO-CB-005', v_order_id, v_order_amount, v_order_qty;
END $$;
