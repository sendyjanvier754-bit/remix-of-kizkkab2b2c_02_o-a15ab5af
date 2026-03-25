
-- 1. Create a function that returns business panel data for a specific country
CREATE OR REPLACE FUNCTION public.get_business_panel_data_for_country(p_country_id UUID)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  item_name TEXT,
  sku TEXT,
  item_type TEXT,
  cost_per_unit NUMERIC,
  weight_kg NUMERIC,
  shipping_cost_per_unit NUMERIC,
  suggested_pvp_per_unit NUMERIC,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Products without variants
  SELECT
    vp.id AS product_id,
    NULL::uuid AS variant_id,
    vp.nombre::TEXT AS item_name,
    vp.sku_interno::TEXT AS sku,
    'product'::TEXT AS item_type,
    vp.precio_b2b AS cost_per_unit,
    COALESCE(ld.weight_kg, 0) AS weight_kg,
    sc_lat.shipping_cost_usd AS shipping_cost_per_unit,
    CASE WHEN sc_lat.shipping_cost_usd IS NOT NULL AND vp.precio_b2b IS NOT NULL
      THEN ROUND((vp.precio_b2b * 3 + sc_lat.shipping_cost_usd)::NUMERIC, 2)
      ELSE ROUND((vp.precio_b2b * 3)::NUMERIC, 2)
    END AS suggested_pvp_per_unit,
    vp.is_active
  FROM v_productos_con_precio_b2b vp
  LEFT JOIN v_logistics_data ld ON vp.id = ld.product_id AND ld.variant_id IS NULL
  LEFT JOIN LATERAL (
    SELECT gps.shipping_cost_usd
    FROM get_product_shipping_cost_by_country(vp.id, p_country_id, 'standard') gps
    LIMIT 1
  ) sc_lat ON p_country_id IS NOT NULL
  WHERE vp.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM product_variants pv WHERE pv.product_id = vp.id AND pv.is_active = TRUE
    )

  UNION ALL

  -- Variants
  SELECT
    vv.product_id,
    vv.id AS variant_id,
    vv.name::TEXT AS item_name,
    vv.sku::TEXT AS sku,
    'variant'::TEXT AS item_type,
    vv.precio_b2b_final AS cost_per_unit,
    COALESCE(ld.weight_kg, 0) AS weight_kg,
    sc_lat.shipping_cost_usd AS shipping_cost_per_unit,
    CASE WHEN sc_lat.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final IS NOT NULL
      THEN ROUND((vv.precio_b2b_final * 3 + sc_lat.shipping_cost_usd)::NUMERIC, 2)
      ELSE ROUND((vv.precio_b2b_final * 3)::NUMERIC, 2)
    END AS suggested_pvp_per_unit,
    vv.is_active
  FROM v_variantes_con_precio_b2b vv
  LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
  LEFT JOIN LATERAL (
    SELECT gps.shipping_cost_usd
    FROM get_product_shipping_cost_by_country(vv.product_id, p_country_id, 'standard') gps
    LIMIT 1
  ) sc_lat ON p_country_id IS NOT NULL
  WHERE vv.is_active = TRUE;
END;
$$;

-- 2. Update sync function to use business panel data with store's country
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
  v_country_id UUID;
  v_log_id UUID;
BEGIN
  -- Get store owner and country from store's market
  SELECT s.owner_user_id, m.destination_country_id 
  INTO v_store_owner, v_country_id
  FROM stores s
  LEFT JOIN markets m ON s.market_id = m.id
  WHERE s.id = p_store_id AND s.auto_sync_b2b = TRUE;
  
  IF v_store_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'Store not found or auto_sync_b2b not enabled');
  END IF;

  -- Log start
  INSERT INTO b2b_sync_logs (store_id, action, details)
  VALUES (p_store_id, 'sync_started', jsonb_build_object('country_id', v_country_id))
  RETURNING id INTO v_log_id;

  -- Insert new products from business panel data
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
    bp.suggested_pvp_per_unit,
    bp.cost_per_unit,
    bp.cost_per_unit,
    CASE 
      WHEN bp.item_type = 'product' THEN COALESCE((SELECT p.stock_fisico FROM v_productos_con_precio_b2b p WHERE p.id = bp.product_id), 0)
      WHEN bp.item_type = 'variant' THEN COALESCE((SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id), 0)
      ELSE 0
    END,
    CASE 
      WHEN bp.item_type = 'product' THEN COALESCE((SELECT p.galeria_imagenes::jsonb FROM products p WHERE p.id = bp.product_id), '[]'::jsonb)
      ELSE COALESCE((SELECT p.galeria_imagenes::jsonb FROM products p WHERE p.id = bp.product_id), '[]'::jsonb)
    END,
    TRUE,
    'b2b_auto_sync',
    (SELECT p.categoria_id FROM products p WHERE p.id = bp.product_id)
  FROM get_business_panel_data_for_country(v_country_id) bp
  WHERE NOT EXISTS (
    SELECT 1 FROM seller_catalog sc
    WHERE sc.seller_store_id = p_store_id
      AND sc.source_product_id = bp.product_id
      AND (sc.variant_id IS NOT DISTINCT FROM bp.variant_id)
  );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- Update existing synced items (skip price_override)
  UPDATE seller_catalog sc
  SET
    precio_venta = bp.suggested_pvp_per_unit,
    precio_costo = bp.cost_per_unit,
    precio_b2b_base = bp.cost_per_unit,
    stock = CASE 
      WHEN bp.item_type = 'product' THEN COALESCE((SELECT p.stock_fisico FROM v_productos_con_precio_b2b p WHERE p.id = bp.product_id), 0)
      WHEN bp.item_type = 'variant' THEN COALESCE((SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id), 0)
      ELSE 0
    END,
    nombre = bp.item_name,
    is_active = TRUE,
    updated_at = NOW()
  FROM get_business_panel_data_for_country(v_country_id) bp
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.source_product_id = bp.product_id
    AND (sc.variant_id IS NOT DISTINCT FROM bp.variant_id)
    AND (sc.price_override IS NOT TRUE);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Deactivate items no longer in B2B catalog
  UPDATE seller_catalog sc
  SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM get_business_panel_data_for_country(v_country_id) bp
      WHERE bp.product_id = sc.source_product_id
        AND (bp.variant_id IS NOT DISTINCT FROM sc.variant_id)
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Update store last sync timestamp
  UPDATE stores SET last_b2b_sync_at = NOW() WHERE id = p_store_id;

  -- Update log
  UPDATE b2b_sync_logs 
  SET action = 'sync_completed',
      products_added = v_added,
      products_updated = v_updated,
      products_removed = v_removed,
      details = jsonb_build_object(
        'added', v_added, 'updated', v_updated, 'removed', v_removed, 
        'country_id', v_country_id, 'completed_at', NOW()
      )
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', TRUE, 'added', v_added, 'updated', v_updated, 'removed', v_removed);
END;
$$;
