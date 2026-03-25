-- Agregar availability_status a seller_catalog
ALTER TABLE seller_catalog 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available'
CHECK (availability_status IN ('pending', 'available', 'out_of_stock'));

COMMENT ON COLUMN seller_catalog.availability_status IS 
'pending = Sincronizado B2B o pagado no entregado (Disponible pronto), available = En stock, out_of_stock = Sin stock';

-- Marcar productos sincronizados B2B existentes como pending
UPDATE seller_catalog SET availability_status = 'pending' WHERE sync_source = 'b2b_auto_sync' AND is_active = TRUE;

-- Actualizar función sync para insertar con pending
CREATE OR REPLACE FUNCTION sync_b2b_catalog_for_store(p_store_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_added INT := 0; v_updated INT := 0; v_removed INT := 0;
  v_store_owner UUID; v_log_id UUID; v_variant_added INT := 0;
BEGIN
  SELECT owner_user_id INTO v_store_owner FROM stores WHERE id = p_store_id AND auto_sync_b2b = TRUE;
  IF v_store_owner IS NULL THEN RETURN jsonb_build_object('error', 'Store not found or auto_sync_b2b not enabled'); END IF;

  INSERT INTO b2b_sync_logs (store_id, action, details)
  VALUES (p_store_id, 'sync_started', jsonb_build_object('store_owner', v_store_owner))
  RETURNING id INTO v_log_id;

  -- INSERT new products
  INSERT INTO seller_catalog (seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, costo_logistica, stock, images, is_active, sync_source, category_id, availability_status)
  SELECT p_store_id, vp.id, NULL, vp.sku_interno, vp.nombre, vp.descripcion_corta,
    vp.precio_b2b, vp.precio_b2b, vp.precio_b2b, 0, COALESCE(vp.stock_fisico, 0),
    to_jsonb(COALESCE(vp.galeria_imagenes, ARRAY[]::text[])), TRUE, 'b2b_auto_sync', vp.categoria_id, 'pending'
  FROM v_productos_con_precio_b2b vp
  WHERE vp.is_active = TRUE AND NOT EXISTS (
    SELECT 1 FROM seller_catalog sc WHERE sc.seller_store_id = p_store_id AND sc.source_product_id = vp.id AND sc.variant_id IS NULL);
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- INSERT new variants
  INSERT INTO seller_catalog (seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, costo_logistica, stock, images, is_active, sync_source, category_id, availability_status)
  SELECT p_store_id, vv.product_id, vv.id, vv.sku, vv.name, NULL,
    vv.precio_b2b_final, vv.precio_b2b_final, vv.precio_b2b_final, 0, COALESCE(vv.stock, 0),
    to_jsonb(COALESCE(vv.images, ARRAY[]::text[])), TRUE, 'b2b_auto_sync',
    (SELECT p.categoria_id FROM products p WHERE p.id = vv.product_id), 'pending'
  FROM v_variantes_con_precio_b2b vv
  WHERE vv.is_active = TRUE AND NOT EXISTS (
    SELECT 1 FROM seller_catalog sc WHERE sc.seller_store_id = p_store_id AND sc.source_product_id = vv.product_id AND sc.variant_id = vv.id);
  GET DIAGNOSTICS v_variant_added = ROW_COUNT;
  v_added := v_added + v_variant_added;

  -- UPDATE existing products
  UPDATE seller_catalog sc SET precio_venta = vp.precio_b2b, precio_costo = vp.precio_b2b, precio_b2b_base = vp.precio_b2b,
    costo_logistica = 0, stock = COALESCE(vp.stock_fisico, 0), nombre = vp.nombre, is_active = TRUE, updated_at = NOW()
  FROM v_productos_con_precio_b2b vp
  WHERE sc.seller_store_id = p_store_id AND sc.sync_source = 'b2b_auto_sync' AND sc.source_product_id = vp.id
    AND sc.variant_id IS NULL AND vp.is_active = TRUE AND (sc.price_override IS NOT TRUE);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- UPDATE existing variants
  UPDATE seller_catalog sc SET precio_venta = vv.precio_b2b_final, precio_costo = vv.precio_b2b_final, precio_b2b_base = vv.precio_b2b_final,
    costo_logistica = 0, stock = COALESCE(vv.stock, 0), nombre = vv.name, is_active = TRUE, updated_at = NOW()
  FROM v_variantes_con_precio_b2b vv
  WHERE sc.seller_store_id = p_store_id AND sc.sync_source = 'b2b_auto_sync' AND sc.source_product_id = vv.product_id
    AND sc.variant_id = vv.id AND vv.is_active = TRUE AND (sc.price_override IS NOT TRUE);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  v_updated := v_updated + v_removed; v_removed := 0;

  -- DEACTIVATE removed
  UPDATE seller_catalog sc SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id AND sc.sync_source = 'b2b_auto_sync' AND sc.is_active = TRUE
    AND NOT EXISTS (SELECT 1 FROM v_productos_con_precio_b2b vp WHERE vp.id = sc.source_product_id AND vp.is_active = TRUE AND sc.variant_id IS NULL)
    AND NOT EXISTS (SELECT 1 FROM v_variantes_con_precio_b2b vv WHERE vv.product_id = sc.source_product_id AND vv.id = sc.variant_id AND vv.is_active = TRUE);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE b2b_sync_logs SET action = 'sync_completed',
    details = jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed, 'availability_status', 'pending'),
    products_added = v_added, products_updated = v_updated, products_removed = v_removed
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', TRUE, 'added', v_added, 'updated', v_updated, 'removed', v_removed, 'availability_status', 'pending');
END;
$$;