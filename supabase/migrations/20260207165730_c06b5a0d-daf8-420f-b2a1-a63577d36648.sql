-- =============================================================================
-- VISTA ACTUALIZADA: v_business_panel_data
-- Ahora incluye shipping_cost desde v_logistics_data
-- =============================================================================

DROP VIEW IF EXISTS v_business_panel_data CASCADE;

CREATE OR REPLACE VIEW v_business_panel_data AS

-- ========== RAMA 1: PRODUCTOS ==========
SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  -- Obtener peso y costo de envío desde v_logistics_data
  COALESCE(ld.weight_kg, 0.3) as weight_kg,
  COALESCE(ld.shipping_cost_per_unit, 0) as shipping_cost_per_unit,
  -- PVP sugerido AHORA INCLUYE envío: (precio_b2b × 2.5) + shipping_cost
  ((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as suggested_pvp_per_unit,
  vp.precio_b2b as investment_1unit,
  ((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as revenue_1unit,
  -- Ganancia = PVP - Costo B2B - Envío (el envío ya está en PVP, así que ganancia = PVP - costo - envío)
  ((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0) - vp.precio_b2b - COALESCE(ld.shipping_cost_per_unit, 0)) as profit_1unit,
  CASE 
    WHEN vp.precio_b2b > 0 THEN (((vp.precio_b2b * 2.5) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  vp.is_active,
  NOW() as last_updated
FROM v_productos_con_precio_b2b vp
LEFT JOIN v_logistics_data ld ON ld.product_id = vp.id AND ld.variant_id IS NULL
WHERE vp.is_active = TRUE

UNION ALL

-- ========== RAMA 2: VARIANTES ==========
SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.name as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  -- Obtener peso y costo de envío desde v_logistics_data
  COALESCE(ld.weight_kg, 0.3) as weight_kg,
  COALESCE(ld.shipping_cost_per_unit, 0) as shipping_cost_per_unit,
  -- PVP sugerido AHORA INCLUYE envío
  ((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as suggested_pvp_per_unit,
  vv.precio_b2b_final as investment_1unit,
  ((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as revenue_1unit,
  ((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0) - vv.precio_b2b_final - COALESCE(ld.shipping_cost_per_unit, 0)) as profit_1unit,
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN (((vv.precio_b2b_final * 2.5) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  vv.is_active,
  NOW() as last_updated
FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON ld.variant_id = vv.id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_data IS 'Vista unificada con BusinessPanel metrics. Ahora incluye shipping_cost desde v_logistics_data para que el PVP sugerido cubra costos de envío.';