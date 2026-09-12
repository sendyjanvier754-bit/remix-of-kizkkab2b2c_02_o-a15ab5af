-- Keep B2B-synced B2C catalog entries aligned with product galleries and variants.
-- This function intentionally only inserts/updates/deactivates rows marked
-- sync_source = 'b2b_auto_sync'; purchased or manually-created seller items
-- are never changed by this synchronization.
CREATE OR REPLACE FUNCTION public.sync_b2b_catalog_for_store(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INT := 0;
  v_variant_added INT := 0;
  v_updated INT := 0;
  v_variant_updated INT := 0;
  v_removed INT := 0;
  v_store_owner UUID;
  v_log_id UUID;
BEGIN
  SELECT owner_user_id INTO v_store_owner
  FROM stores
  WHERE id = p_store_id
    AND auto_sync_b2b = TRUE;

  IF v_store_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'Store not found or auto_sync_b2b not enabled');
  END IF;

  INSERT INTO b2b_sync_logs (store_id, action, details)
  VALUES (p_store_id, 'sync_started', jsonb_build_object('store_owner', v_store_owner))
  RETURNING id INTO v_log_id;

  -- Products without active variants: copy the complete B2B gallery.
  INSERT INTO seller_catalog (
    seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, costo_logistica,
    stock, images, is_active, sync_source, category_id
  )
  SELECT
    p_store_id,
    vp.id,
    NULL,
    vp.sku_interno,
    vp.nombre,
    vp.descripcion_corta,
    vp.precio_b2b,
    vp.precio_b2b,
    vp.precio_b2b,
    0,
    COALESCE(vp.stock_fisico, 0),
    to_jsonb(COALESCE(vp.galeria_imagenes, ARRAY[]::text[])),
    TRUE,
    'b2b_auto_sync',
    vp.categoria_id
  FROM v_productos_con_precio_b2b vp
  WHERE vp.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.product_id = vp.id
        AND pv.is_active = TRUE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM seller_catalog sc
      WHERE sc.seller_store_id = p_store_id
        AND sc.source_product_id = vp.id
        AND sc.variant_id IS NULL
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- Variants: copy each variant's own image array, not only the parent gallery.
  INSERT INTO seller_catalog (
    seller_store_id, source_product_id, variant_id, sku, nombre, descripcion,
    precio_venta, precio_costo, precio_b2b_base, costo_logistica,
    stock, images, is_active, sync_source, category_id
  )
  SELECT
    p_store_id,
    vv.product_id,
    vv.id,
    vv.sku,
    vv.name,
    NULL,
    vv.precio_b2b_final,
    vv.precio_b2b_final,
    vv.precio_b2b_final,
    0,
    COALESCE(vv.stock, 0),
    to_jsonb(COALESCE(vv.images, ARRAY[]::text[])),
    TRUE,
    'b2b_auto_sync',
    (SELECT p.categoria_id FROM products p WHERE p.id = vv.product_id)
  FROM v_variantes_con_precio_b2b vv
  WHERE vv.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM seller_catalog sc
      WHERE sc.seller_store_id = p_store_id
        AND sc.source_product_id = vv.product_id
        AND sc.variant_id = vv.id
    );
  GET DIAGNOSTICS v_variant_added = ROW_COUNT;
  v_added := v_added + v_variant_added;

  -- Product updates always refresh gallery and descriptive data. Price override
  -- only protects the B2C selling price, as before.
  UPDATE seller_catalog sc
  SET
    precio_venta = CASE
      WHEN sc.price_override IS TRUE THEN sc.precio_venta
      ELSE vp.precio_b2b
    END,
    precio_costo = vp.precio_b2b,
    precio_b2b_base = vp.precio_b2b,
    costo_logistica = 0,
    stock = COALESCE(vp.stock_fisico, 0),
    sku = vp.sku_interno,
    nombre = vp.nombre,
    descripcion = vp.descripcion_corta,
    images = to_jsonb(COALESCE(vp.galeria_imagenes, ARRAY[]::text[])),
    category_id = vp.categoria_id,
    is_active = TRUE,
    updated_at = NOW()
  FROM v_productos_con_precio_b2b vp
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = vp.id
    AND sc.variant_id IS NULL
    AND vp.is_active = TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Variant updates always refresh the variant identity fields and its own images.
  UPDATE seller_catalog sc
  SET
    precio_venta = CASE
      WHEN sc.price_override IS TRUE THEN sc.precio_venta
      ELSE vv.precio_b2b_final
    END,
    precio_costo = vv.precio_b2b_final,
    precio_b2b_base = vv.precio_b2b_final,
    costo_logistica = 0,
    stock = COALESCE(vv.stock, 0),
    sku = vv.sku,
    nombre = vv.name,
    images = to_jsonb(COALESCE(vv.images, ARRAY[]::text[])),
    category_id = (SELECT p.categoria_id FROM products p WHERE p.id = vv.product_id),
    is_active = TRUE,
    updated_at = NOW()
  FROM v_variantes_con_precio_b2b vv
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = vv.product_id
    AND sc.variant_id = vv.id
    AND vv.is_active = TRUE;
  GET DIAGNOSTICS v_variant_updated = ROW_COUNT;
  v_updated := v_updated + v_variant_updated;

  -- Deactivate only B2B-synchronized entries no longer active in B2B.
  UPDATE seller_catalog sc
  SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM v_productos_con_precio_b2b vp
      WHERE sc.variant_id IS NULL
        AND vp.id = sc.source_product_id
        AND vp.is_active = TRUE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM v_variantes_con_precio_b2b vv
      WHERE sc.variant_id = vv.id
        AND vv.product_id = sc.source_product_id
        AND vv.is_active = TRUE
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE stores
  SET last_b2b_sync_at = NOW()
  WHERE id = p_store_id;

  UPDATE b2b_sync_logs
  SET action = 'sync_completed',
      products_added = v_added,
      products_updated = v_updated,
      products_removed = v_removed,
      details = jsonb_build_object(
        'added', v_added,
        'updated', v_updated,
        'removed', v_removed,
        'products_added', v_added - v_variant_added,
        'variants_added', v_variant_added,
        'products_updated', v_updated - v_variant_updated,
        'variants_updated', v_variant_updated,
        'gallery_and_variant_images_synced', TRUE,
        'completed_at', NOW()
      )
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'added', v_added,
    'updated', v_updated,
    'removed', v_removed,
    'products_added', v_added - v_variant_added,
    'variants_added', v_variant_added,
    'products_updated', v_updated - v_variant_updated,
    'variants_updated', v_variant_updated,
    'gallery_and_variant_images_synced', TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_b2b_catalog_for_store(UUID) TO anon, authenticated;
