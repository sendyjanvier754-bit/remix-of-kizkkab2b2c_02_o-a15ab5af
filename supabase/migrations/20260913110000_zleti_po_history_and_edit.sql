-- ZleTI PO history/edit support.
-- zleti_manual_po_items already stores every generated PO line permanently.

CREATE OR REPLACE FUNCTION public.update_zleti_manual_po(
  p_po_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_items integer;
  v_total_quantity integer;
  v_total_amount numeric(12,2);
  v_po_number text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators can edit ZleTI purchase orders';
  END IF;

  SELECT po_number INTO v_po_number
  FROM public.master_purchase_orders
  WHERE id = p_po_id AND brand_identity = 'zleti'
  FOR UPDATE;

  IF v_po_number IS NULL THEN
    RAISE EXCEPTION 'ZleTI purchase order not found';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A purchase order must contain at least one item';
  END IF;

  DELETE FROM public.zleti_manual_po_items WHERE po_id = p_po_id;

  INSERT INTO public.zleti_manual_po_items (
    po_id, product_id, variant_id, sku, product_name, variant_name,
    color, size, image_url, source_url, quantity, unit_cost, total_cost
  )
  SELECT
    p_po_id, item.product_id, item.variant_id, item.sku, item.product_name,
    item.variant_name, item.color, item.size, item.image_url, item.source_url,
    item.quantity, item.unit_cost, item.unit_cost * item.quantity
  FROM jsonb_to_recordset(p_items) AS item(
    product_id uuid, variant_id uuid, sku text, product_name text,
    variant_name text, color text, size text, image_url text, source_url text,
    quantity integer, unit_cost numeric
  );

  SELECT COUNT(*)::integer, COALESCE(SUM(quantity), 0)::integer,
         COALESCE(SUM(total_cost), 0)::numeric(12,2)
  INTO v_total_items, v_total_quantity, v_total_amount
  FROM public.zleti_manual_po_items
  WHERE po_id = p_po_id;

  UPDATE public.master_purchase_orders
  SET notes = p_notes,
      total_items = v_total_items,
      total_quantity = v_total_quantity,
      total_amount = v_total_amount,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'po_id', p_po_id,
    'po_number', v_po_number,
    'total_items', v_total_items,
    'total_quantity', v_total_quantity,
    'total_amount', v_total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_zleti_manual_po(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_zleti_manual_po(uuid, jsonb, text) TO authenticated;
