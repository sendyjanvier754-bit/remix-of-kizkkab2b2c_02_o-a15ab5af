-- =============================================================================
-- ACTUALIZAR: v_business_panel_with_shipping_functions
-- Fecha: 2026-02-12
-- Propósito: Integrar v_precio_sugerido_con_logistica para productos
-- =============================================================================

CREATE OR REPLACE VIEW v_business_panel_with_shipping_functions AS

WITH route_config AS (
  SELECT sr.id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
  LIMIT 1
)

-- ============================================================================
-- Rama 1: PRODUCTOS (usa v_precio_sugerido_con_logistica con lógica inteligente)
-- ============================================================================
SELECT
  vpsl.product_id,
  NULL::uuid as variant_id,
  vpsl.product_name as item_name,
  vpsl.sku as sku,
  'product' as item_type,
  
  -- Costo por unidad (precio B2B)
  vpsl.precio_b2b as cost_per_unit,
  
  -- Peso
  vpsl.peso_kg as weight_kg,
  
  -- Costo de envío por unidad (desde la vista optimizada)
  vpsl.costo_logistica_actual as shipping_cost_per_unit,
  
  -- PVP sugerido por unidad (NUEVA LÓGICA INTELIGENTE)
  -- Usa markup de categoría o precio B2C si es mayor
  vpsl.pvp_sugerido as suggested_pvp_per_unit,
  
  -- Inversión por 1 unidad (solo costo B2B)
  vpsl.precio_b2b as investment_1unit,
  
  -- Ingreso por 1 unidad (PVP sugerido inteligente)
  vpsl.pvp_sugerido as revenue_1unit,
  
  -- Ganancia por 1 unidad (PVP - Costo Total con logística)
  vpsl.ganancia_por_unidad as profit_1unit,
  
  -- Margen porcentual sobre costo total
  vpsl.markup_sobre_costo_total_percent as margin_percentage,
  
  -- Metadata
  vpsl.is_active,
  vpsl.last_updated

FROM v_precio_sugerido_con_logistica vpsl

UNION ALL

-- ============================================================================
-- Rama 2: VARIANTES (mantiene cálculo manual)
-- ============================================================================
SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.name as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  COALESCE(ld.weight_kg, 0) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )) as shipping_cost_per_unit,
  
  -- PVP sugerido para variantes: precio_b2b * 4.0 (fallback) + envío
  (vv.precio_b2b_final * 4.0) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as suggested_pvp_per_unit,
  
  vv.precio_b2b_final as investment_1unit,
  (vv.precio_b2b_final * 4.0) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as revenue_1unit,
  
  ((vv.precio_b2b_final * 4.0) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) - vv.precio_b2b_final - COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0)) as profit_1unit,
  
  CASE 
    WHEN (vv.precio_b2b_final + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
      (SELECT route_id FROM default_route_id LIMIT 1),
      COALESCE(ld.weight_kg, 0)
    )), 0)) > 0 THEN (
      ((vv.precio_b2b_final * 4.0) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0) - vv.precio_b2b_final - COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0)) / (vv.precio_b2b_final + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0)) * 100
    )::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vv.is_active,
  NOW() as last_updated

FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

-- =============================================================================
-- COMENTARIO ACTUALIZADO
-- =============================================================================

COMMENT ON VIEW v_business_panel_with_shipping_functions IS 
  'Business panel actualizado. PRODUCTOS: usa v_precio_sugerido_con_logistica (lógica inteligente: markup categoría o B2C si es mayor). VARIANTES: cálculo manual con fallback 4x.';

-- =============================================================================
-- PERMISOS
-- =============================================================================

GRANT SELECT ON v_business_panel_with_shipping_functions TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- Test 1: Ver productos con nueva lógica
SELECT 
  sku,
  item_name,
  item_type,
  cost_per_unit as precio_b2b,
  shipping_cost_per_unit as logistica,
  suggested_pvp_per_unit as pvp_sugerido,
  profit_1unit as ganancia,
  margin_percentage || '%' as margen
FROM v_business_panel_with_shipping_functions
WHERE item_type = 'product'
ORDER BY sku
LIMIT 10;

-- Test 2: Comparar productos vs variantes
SELECT 
  item_type,
  COUNT(*) as cantidad,
  ROUND(AVG(cost_per_unit), 2) as avg_costo,
  ROUND(AVG(shipping_cost_per_unit), 2) as avg_envio,
  ROUND(AVG(suggested_pvp_per_unit), 2) as avg_pvp,
  ROUND(AVG(profit_1unit), 2) as avg_ganancia,
  ROUND(AVG(margin_percentage), 1) || '%' as avg_margen
FROM v_business_panel_with_shipping_functions
GROUP BY item_type;

-- Test 3: Ver productos con mejor margen
SELECT 
  sku,
  item_name,
  cost_per_unit,
  suggested_pvp_per_unit,
  profit_1unit,
  margin_percentage || '%' as margen
FROM v_business_panel_with_shipping_functions
WHERE item_type = 'product'
ORDER BY margin_percentage DESC
LIMIT 10;

-- =============================================================================
-- RESULTADO ESPERADO:
-- - Productos usan lógica inteligente de v_precio_sugerido_con_logistica
-- - Variantes usan multiplicador 4x (fallback)
-- - Márgenes calculados sobre costo total (B2B + logística)
-- =============================================================================

SELECT 'Vista v_business_panel_with_shipping_functions actualizada: PRODUCTOS con lógica inteligente, VARIANTES con fallback 4x' as status;
