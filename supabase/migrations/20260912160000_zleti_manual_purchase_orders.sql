-- Multi-brand manual Purchase Orders for ZleTI.
-- Existing Kizkka PO flows remain unchanged because the default identity is kizkka.

ALTER TABLE public.master_purchase_orders
  ADD COLUMN IF NOT EXISTS brand_identity text NOT NULL DEFAULT 'kizkka';

ALTER TABLE public.master_purchase_orders
  DROP CONSTRAINT IF EXISTS master_purchase_orders_brand_identity_check;

ALTER TABLE public.master_purchase_orders
  ADD CONSTRAINT master_purchase_orders_brand_identity_check
  CHECK (brand_identity IN ('kizkka', 'zleti'));

UPDATE public.master_purchase_orders
SET brand_identity = 'kizkka'
WHERE brand_identity IS NULL;

CREATE INDEX IF NOT EXISTS idx_master_purchase_orders_brand_identity
  ON public.master_purchase_orders (brand_identity, created_at DESC);

CREATE TABLE IF NOT EXISTS public.zleti_manual_po_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  variant_id uuid,
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_name text,
  color text,
  size text,
  image_url text,
  source_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zleti_manual_po_items_po_id
  ON public.zleti_manual_po_items (po_id);

ALTER TABLE public.zleti_manual_po_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to zleti manual po items" ON public.zleti_manual_po_items;
CREATE POLICY "Admins full access to zleti manual po items"
  ON public.zleti_manual_po_items
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_zleti_manual_po(
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_po_number text;
  v_next_number integer;
  v_total_items integer;
  v_total_quantity integer;
  v_total_amount numeric(12,2);
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators can create ZleTI purchase orders';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product is required';
  END IF;

  SELECT COALESCE(MAX((regexp_match(po_number, '^PO-ZLT-([0-9]+)$'))[1]::integer), 0) + 1
  INTO v_next_number
  FROM public.master_purchase_orders
  WHERE brand_identity = 'zleti'
    AND po_number ~ '^PO-ZLT-[0-9]+$';

  v_po_number := 'PO-ZLT-' || lpad(v_next_number::text, 3, '0');

  INSERT INTO public.master_purchase_orders (
    po_number, brand_identity, status, notes, total_orders,
    total_items, total_quantity, total_amount, created_by
  )
  VALUES (
    v_po_number, 'zleti', 'open', p_notes, 0,
    0, 0, 0, auth.uid()
  )
  RETURNING id INTO v_po_id;

  INSERT INTO public.zleti_manual_po_items (
    po_id, product_id, variant_id, sku, product_name, variant_name,
    color, size, image_url, source_url, quantity, unit_cost, total_cost
  )
  SELECT
    v_po_id,
    item.product_id,
    item.variant_id,
    item.sku,
    item.product_name,
    item.variant_name,
    item.color,
    item.size,
    item.image_url,
    item.source_url,
    item.quantity,
    item.unit_cost,
    item.unit_cost * item.quantity
  FROM jsonb_to_recordset(p_items) AS item(
    product_id uuid,
    variant_id uuid,
    sku text,
    product_name text,
    variant_name text,
    color text,
    size text,
    image_url text,
    source_url text,
    quantity integer,
    unit_cost numeric
  );

  SELECT COUNT(*)::integer, COALESCE(SUM(quantity), 0)::integer, COALESCE(SUM(total_cost), 0)::numeric(12,2)
  INTO v_total_items, v_total_quantity, v_total_amount
  FROM public.zleti_manual_po_items
  WHERE po_id = v_po_id;

  UPDATE public.master_purchase_orders
  SET total_items = v_total_items,
      total_quantity = v_total_quantity,
      total_amount = v_total_amount,
      updated_at = now()
  WHERE id = v_po_id;

  RETURN jsonb_build_object(
    'po_id', v_po_id,
    'po_number', v_po_number,
    'brand_identity', 'zleti',
    'total_items', v_total_items,
    'total_quantity', v_total_quantity,
    'total_amount', v_total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_zleti_manual_po(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_zleti_manual_po(jsonb, text) TO authenticated;
