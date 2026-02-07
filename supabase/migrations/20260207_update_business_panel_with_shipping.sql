-- =============================================================================
-- ACTUALIZACIÓN: v_logistics_data + v_business_panel_data CON COSTOS DE LOGÍSTICA
-- Fecha: 2026-02-07
-- Propósito: Incluir costos de envío en v_logistics_data, luego en v_business_panel_data
-- =============================================================================

-- 1. RECREAR v_logistics_data CON COSTOS DE ENVÍO
-- =============================================================================
DROP VIEW IF EXISTS v_business_panel_data CASCADE;
DROP VIEW IF EXISTS v_logistics_data CASCADE;

CREATE OR REPLACE VIEW v_logistics_data AS

-- Subquery para obtener tarifa STANDARD de ruta CHINA-USA
WITH route_config AS (
  SELECT 
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb
  FROM shipping_tiers st
  WHERE st.tier_type = 'STANDARD' AND st.is_active = TRUE
  LIMIT 1
),
zone_config AS (
  SELECT 
    final_delivery_surcharge
  FROM shipping_zones
  WHERE zone_name = 'HAITI_CENTRO' AND is_active = TRUE
  LIMIT 1
)

-- 1. DATOS PARA PRODUCTOS QUE NO TIENEN VARIANTES
SELECT
    p.id AS product_id,
    NULL::uuid AS variant_id,
    'PRODUCT' AS item_type,
    p.nombre AS item_name,
    p.sku_interno AS sku,
    
    -- Estandarización de peso a KG
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0
    ) AS weight_kg,
    
    -- Dimensiones en CM
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.is_oversize,
    
    -- Costo de envío por KG (STANDARD tier, HAITI_CENTRO zone)
    CEIL(COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0)) 
      * (SELECT tramo_a_cost_per_kg FROM route_config)
    + CEIL(COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0)) 
      * 2.20462 
      * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0) AS shipping_cost_per_unit,
    
    p.is_active
FROM
    products p

WHERE p.is_active = TRUE

UNION ALL

-- 2. DATOS PARA VARIANTES DE PRODUCTO
SELECT
    pv.product_id,
    pv.id AS variant_id,
    'VARIANT' AS item_type,
    p.nombre || ' - ' || pv.name AS item_name,
    pv.sku,
    
    -- Las variantes heredan el peso del producto padre
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0
    ) AS weight_kg,
    
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.is_oversize,
    
    -- Costo de envío por KG (STANDARD tier, HAITI_CENTRO zone)
    CEIL(COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0)) 
      * (SELECT tramo_a_cost_per_kg FROM route_config)
    + CEIL(COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0)) 
      * 2.20462 
      * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0) AS shipping_cost_per_unit,
    
    pv.is_active
FROM
    product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_logistics_data IS 
  'Unified logistics data with weight and shipping cost per unit (STANDARD tier, HAITI_CENTRO zone).';

-- 2. RECREAR v_business_panel_data CON COSTO DE ENVÍO
-- =============================================================================
CREATE OR REPLACE VIEW v_business_panel_data AS

-- ========== RAMA 1: PRODUCTOS ==========
SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  COALESCE(ld.weight_kg, 0) as weight_kg,
  COALESCE(ld.shipping_cost_per_unit, 0) as shipping_cost_per_unit,
  
  -- PVP sugerido = (precio_b2b × 2.5) + costo_envío
  ((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as suggested_pvp_per_unit,
  
  vp.precio_b2b as investment_1unit,
  ((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as revenue_1unit,
  (((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) - vp.precio_b2b) as profit_1unit,
  
  CASE 
    WHEN vp.precio_b2b > 0 THEN ((((vp.precio_b2b * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vp.is_active,
  NOW() as last_updated
  
FROM v_productos_con_precio_b2b vp
LEFT JOIN v_logistics_data ld ON vp.id = ld.product_id AND ld.variant_id IS NULL
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
  COALESCE(ld.weight_kg, 0) as weight_kg,
  COALESCE(ld.shipping_cost_per_unit, 0) as shipping_cost_per_unit,
  
  -- PVP sugerido = (precio_b2b × 2.5) + costo_envío
  ((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as suggested_pvp_per_unit,
  
  vv.precio_b2b_final as investment_1unit,
  ((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) as revenue_1unit,
  (((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) - vv.precio_b2b_final) as profit_1unit,
  
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN ((((vv.precio_b2b_final * 2.5) + COALESCE(ld.shipping_cost_per_unit, 0)) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vv.is_active,
  NOW() as last_updated
  
FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_data IS 
  'Unified view with BusinessPanel metrics INCLUDING shipping costs. PVP = (precio_b2b × 2.5) + shipping_cost.';

-- =============================================================================
-- CAMBIOS REALIZADOS
-- =============================================================================
-- v_logistics_data AHORA INCLUYE:
--   - weight_kg: peso estandarizado
--   - shipping_cost_per_unit: costo de envío calculado (sin fallback)
--
-- v_business_panel_data AHORA INCLUYE:
--   - shipping_cost_per_unit: tomado de v_logistics_data
--   - suggested_pvp_per_unit = (precio_b2b × 2.5) + shipping_cost_per_unit
--
-- IMPACTO EN FRONTEND (SellerCartPage.tsx):
--   - profitAnalysis.ganancia DEBE CAMBIAR DE:
--     ganancia = venta - inversion - totalShippingCost
--   - A:
--     ganancia = venta - inversion
--   - El envío YA está incluido en venta (suggestedPVP)
-- =============================================================================
