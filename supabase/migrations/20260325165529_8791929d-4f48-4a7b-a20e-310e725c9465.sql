
-- Drop the helper function we no longer need
DROP FUNCTION IF EXISTS public.get_business_panel_data_for_country(UUID);

-- Recreate sync function using v_business_panel_data directly
-- by setting the request.jwt.claim.sub to the store owner's user_id
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
  v_old_role TEXT;
BEGIN
  -- Get store owner
  SELECT owner_user_id INTO v_store_owner
  FROM stores WHERE id = p_store_id AND auto_sync_b2b = TRUE;
  
  IF v_store_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'Store not found or auto_sync_b2b not enabled');
  END IF;

  -- Set auth context to store owner so v_business_panel_data resolves correctly
  PERFORM set_config('request.jwt.claim.sub', v_store_owner::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Log start
  INSERT INTO b2b_sync_logs (store_id, action, details)
  VALUES (p_store_id, 'sync_started', jsonb_build_object('store_owner', v_store_owner))
  RETURNING id INTO v_log_id;

  -- Insert new items from v_business_panel_data
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
      WHEN bp.variant_id IS NULL THEN COALESCE((SELECT p.stock_fisico FROM v_productos_con_precio_b2b p WHERE p.id = bp.product_id), 0)
      ELSE COALESCE((SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id), 0)
    END,
    COALESCE((SELECT p.galeria_imagenes::jsonb FROM products p WHERE p.id = bp.product_id), '[]'::jsonb),
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

  -- Update existing synced items (skip price_override)
  UPDATE seller_catalog sc
  SET
    precio_venta = COALESCE(bp.suggested_pvp_per_unit, bp.cost_per_unit * 3),
    precio_costo = bp.cost_per_unit,
    precio_b2b_base = bp.cost_per_unit,
    stock = CASE 
      WHEN bp.variant_id IS NULL THEN COALESCE((SELECT p.stock_fisico FROM v_productos_con_precio_b2b p WHERE p.id = bp.product_id), 0)
      ELSE COALESCE((SELECT pv.stock FROM product_variants pv WHERE pv.id = bp.variant_id), 0)
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

  -- Deactivate items no longer in B2B catalog
  UPDATE seller_catalog sc
  SET is_active = FALSE, updated_at = NOW()
  WHERE sc.seller_store_id = p_store_id
    AND sc.sync_source = 'b2b_auto_sync'
    AND sc.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM v_business_panel_data bp
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
        'store_owner', v_store_owner, 'completed_at', NOW()
      )
  WHERE id = v_log_id;

  -- Reset auth context
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('role', '', true);

  RETURN jsonb_build_object('success', TRUE, 'added', v_added, 'updated', v_updated, 'removed', v_removed);
END;
$$;
