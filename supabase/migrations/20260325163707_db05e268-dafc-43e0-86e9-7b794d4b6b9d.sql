
-- 1. Allow admins to update stores (for auto_sync_b2b toggle)
CREATE POLICY "Admins can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Recreate sync function as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.sync_b2b_catalog_for_store(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INT := 0;
  v_added_variants INT := 0;
  v_updated INT := 0;
  v_updated_variants INT := 0;
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

  -- Insert new products (without variants)
  INSERT INTO seller_catalog (
    seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, stock, images, 
    is_active, sync_source, category_id
  )
  SELECT
    p_store_id,
    vp.id,
    NULL,
    vp.sku_interno,
    vp.nombre,
    vp.descripcion_corta,
    COALESCE(vp.precio_sugerido_venta, vp.precio_b2b * 3),
    vp.precio_b2b,
    vp.precio_b2b,
    vp.stock_fisico,
    COALESCE(vp.galeria_imagenes::jsonb, '[]'::jsonb),
    TRUE,
    'b2b_auto_sync',
    vp.categoria_id
  FROM v_productos_con_precio_b2b vp
  WHERE vp.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM seller_catalog sc
      WHERE sc.seller_store_id = p_store_id
        AND sc.source_product_id = vp.id
        AND sc.variant_id IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM product_variants pv WHERE pv.product_id = vp.id AND pv.is_active = TRUE
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- Insert new variants
  INSERT INTO seller_catalog (
    seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, stock, images, 
    is_active, sync_source, category_id
  )
  SELECT
    p_store_id,
    vv.product_id,
    vv.id,
    vv.sku,
    vv.name,
    NULL,
    vv.precio_b2b_final * 3,
    vv.precio_b2b_final,
    vv.precio_b2b_final,
    vv.stock,
    COALESCE(
      (SELECT p.galeria_imagenes::jsonb FROM products p WHERE p.id = vv.product_id),
      '[]'::jsonb
    ),
    TRUE,
    'b2b_auto_sync',
    (SELECT p.categoria_id FROM products p WHERE p.id = vv.product_id)
  FROM v_variantes_con_precio_b2b vv
  WHERE vv.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM seller_catalog sc
      WHERE sc.seller_store_id = p_store_id
        AND sc.source_product_id = vv.product_id
        AND sc.variant_id = vv.id
    );
  GET DIAGNOSTICS v_added_variants = ROW_COUNT;
  v_added := v_added + v_added_variants;

  -- Update existing synced products (skip price_override)
  UPDATE seller_catalog sc
  SET
    precio_venta = COALESCE(vp.precio_sugerido_venta, vp.precio_b2b * 3),
    precio_costo = vp.precio_b2b,
    precio_b2b_base = vp.precio_b2b,
    stock = vp.stock_fisico,
    nombre = vp.nombre,
    is_active = TRUE,
    updated_at = NOW()
  FROM v_productos_con_precio_b2b vp
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = vp.id
    AND sc.variant_id IS NULL
    AND sc.price_override IS NOT TRUE
    AND vp.is_active = TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update existing synced variants (skip price_override)
  UPDATE seller_catalog sc
  SET
    precio_venta = vv.precio_b2b_final * 3,
    precio_costo = vv.precio_b2b_final,
    precio_b2b_base = vv.precio_b2b_final,
    stock = vv.stock,
    nombre = vv.name,
    is_active = TRUE,
    updated_at = NOW()
  FROM v_variantes_con_precio_b2b vv
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = vv.product_id
    AND sc.variant_id = vv.id
    AND sc.price_override IS NOT TRUE
    AND vv.is_active = TRUE;
  GET DIAGNOSTICS v_updated_variants = ROW_COUNT;
  v_updated := v_updated + v_updated_variants;

  -- Deactivate removed products
  UPDATE seller_catalog sc
  SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM v_productos_con_precio_b2b vp
      WHERE vp.id = sc.source_product_id AND sc.variant_id IS NULL AND vp.is_active = TRUE
    )
    AND NOT EXISTS (
      SELECT 1 FROM v_variantes_con_precio_b2b vv
      WHERE vv.product_id = sc.source_product_id AND vv.id = sc.variant_id AND vv.is_active = TRUE
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

-- 3. Recreate sync_all as SECURITY DEFINER too
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
    v_result := sync_b2b_catalog_for_store(v_store.id);
    v_results := v_results || jsonb_build_object('store', v_store.name, 'result', v_result);
  END LOOP;
  
  RETURN v_results;
END;
$$;
