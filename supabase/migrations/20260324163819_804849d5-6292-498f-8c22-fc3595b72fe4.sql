
-- 1. Add auto_sync_b2b flag to stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS auto_sync_b2b BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_b2b_sync_at TIMESTAMPTZ;

-- 2. Add sync tracking columns to seller_catalog
ALTER TABLE public.seller_catalog 
ADD COLUMN IF NOT EXISTS sync_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_override BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.seller_catalog.sync_source IS 'NULL=manual, b2b_auto_sync=synced from B2B catalog';
COMMENT ON COLUMN public.seller_catalog.price_override IS 'If true, precio_venta wont be overwritten by sync';

-- 3. Create audit log table
CREATE TABLE IF NOT EXISTS public.b2b_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  products_added INT DEFAULT 0,
  products_updated INT DEFAULT 0,
  products_removed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.b2b_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync logs" ON public.b2b_sync_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert sync logs" ON public.b2b_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.b2b_sync_logs TO anon, authenticated;

-- 4. Sync function for a single store
CREATE OR REPLACE FUNCTION public.sync_b2b_catalog_for_store(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INT := 0;
  v_updated INT := 0;
  v_removed INT := 0;
  v_store_owner UUID;
  v_log_id UUID;
BEGIN
  SELECT owner_user_id INTO v_store_owner
  FROM stores WHERE id = p_store_id AND auto_sync_b2b = TRUE;
  
  IF v_store_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'Store not found or auto_sync_b2b not enabled');
  END IF;

  INSERT INTO b2b_sync_logs (store_id, action, details)
  VALUES (p_store_id, 'sync_started', '{}'::jsonb)
  RETURNING id INTO v_log_id;

  -- Insert new products
  INSERT INTO seller_catalog (
    seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, stock, images, 
    is_active, sync_source, category_id
  )
  SELECT
    p_store_id,
    bp.product_id,
    bp.variant_id,
    bp.sku,
    bp.item_name,
    NULL,
    COALESCE(bp.suggested_pvp_per_unit, bp.cost_per_unit * 3),
    bp.cost_per_unit,
    bp.cost_per_unit,
    CASE 
      WHEN bp.item_type = 'product' THEN (SELECT p.stock FROM products p WHERE p.id = bp.product_id)
      WHEN bp.item_type = 'variant' THEN (SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id)
      ELSE 0
    END,
    CASE 
      WHEN bp.item_type = 'product' THEN COALESCE((SELECT p.galeria_imagenes::jsonb FROM products p WHERE p.id = bp.product_id), '[]'::jsonb)
      ELSE '[]'::jsonb
    END,
    TRUE,
    'b2b_auto_sync',
    (SELECT p.categoria_id FROM products p WHERE p.id = bp.product_id)
  FROM v_business_panel_data bp
  WHERE NOT EXISTS (
    SELECT 1 FROM seller_catalog sc
    WHERE sc.seller_store_id = p_store_id
      AND sc.source_product_id = bp.product_id
      AND (sc.variant_id IS NOT DISTINCT FROM bp.variant_id)
  );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- Update existing synced products (skip price_override)
  UPDATE seller_catalog sc
  SET
    precio_venta = COALESCE(bp.suggested_pvp_per_unit, bp.cost_per_unit * 3),
    precio_costo = bp.cost_per_unit,
    precio_b2b_base = bp.cost_per_unit,
    stock = CASE 
      WHEN bp.item_type = 'product' THEN (SELECT p.stock FROM products p WHERE p.id = bp.product_id)
      WHEN bp.item_type = 'variant' THEN (SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id)
      ELSE 0
    END,
    nombre = bp.item_name,
    is_active = TRUE,
    updated_at = NOW()
  FROM v_business_panel_data bp
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = bp.product_id
    AND (sc.variant_id IS NOT DISTINCT FROM bp.variant_id)
    AND (sc.price_override IS NOT TRUE);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Deactivate removed products
  UPDATE seller_catalog sc
  SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND NOT EXISTS (
      SELECT 1 FROM v_business_panel_data bp
      WHERE bp.product_id = sc.source_product_id
        AND (bp.variant_id IS NOT DISTINCT FROM sc.variant_id)
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE stores SET last_b2b_sync_at = NOW() WHERE id = p_store_id;

  UPDATE b2b_sync_logs 
  SET action = 'sync_completed',
      products_added = v_added,
      products_updated = v_updated,
      products_removed = v_removed,
      details = jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed, 'completed_at', NOW())
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', TRUE, 'added', v_added, 'updated', v_updated, 'removed', v_removed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_b2b_catalog_for_store(UUID) TO anon, authenticated;

-- 5. Sync ALL enabled stores
CREATE OR REPLACE FUNCTION public.sync_all_b2b_stores()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store RECORD;
  v_results JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  FOR v_store IN SELECT id, name FROM stores WHERE auto_sync_b2b = TRUE AND is_active = TRUE
  LOOP
    BEGIN
      v_result := sync_b2b_catalog_for_store(v_store.id);
      v_results := v_results || jsonb_build_object('store_id', v_store.id, 'store_name', v_store.name, 'result', v_result);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO b2b_sync_logs (store_id, action, details)
      VALUES (v_store.id, 'sync_error', jsonb_build_object('error', SQLERRM));
      v_results := v_results || jsonb_build_object('store_id', v_store.id, 'store_name', v_store.name, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('stores_synced', jsonb_array_length(v_results), 'results', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_all_b2b_stores() TO anon, authenticated;
