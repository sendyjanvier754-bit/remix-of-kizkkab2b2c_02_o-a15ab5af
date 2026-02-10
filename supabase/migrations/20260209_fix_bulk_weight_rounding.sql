-- =============================================================================
-- FIX: REDONDEO DE PESO TOTAL EN CARRITO (NO POR ÍTEM INDIVIDUAL)
-- Fecha: 2026-02-09
-- Problema: Actualmente cada item redondea su peso con CEIL por separado
-- Solución: Quitar CEIL de v_logistics_data, calcular peso total primero
-- =============================================================================

-- 1. ACTUALIZAR v_logistics_data para NO redondear pesos individuales
-- Solo devuelve peso real, sin calcular costo (será calculado a nivel carrito)
-- =============================================================================

DROP VIEW IF EXISTS v_business_panel_data CASCADE;
DROP VIEW IF EXISTS v_logistics_data CASCADE;

CREATE OR REPLACE VIEW v_logistics_data AS

-- 1. DATOS PARA PRODUCTOS QUE NO TIENEN VARIANTES
SELECT
    p.id AS product_id,
    NULL::uuid AS variant_id,
    'PRODUCT' AS item_type,
    p.nombre AS item_name,
    p.sku_interno AS sku,
    
    -- Peso en KG sin redondear (redondeo se hará a nivel carrito)
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0,
        0
    ) AS weight_kg,
    
    -- Dimensiones en CM
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.is_oversize,
    
    -- NULL - costo se calculará a nivel carrito
    NULL::numeric AS shipping_cost_per_unit,
    
    p.is_active
FROM
    products p
WHERE 
    p.is_active = TRUE

UNION ALL

-- 2. DATOS PARA VARIANTES DE PRODUCTO
SELECT
    pv.product_id,
    pv.id AS variant_id,
    'VARIANT' AS item_type,
    p.nombre || ' - ' || pv.name AS item_name,
    pv.sku,
    
    -- Peso en KG sin redondear (heredado del producto padre)
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0,
        0
    ) AS weight_kg,
    
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.is_oversize,
    
    -- NULL - costo se calculará a nivel carrito
    NULL::numeric AS shipping_cost_per_unit,
    
    pv.is_active
FROM
    product_variants pv
JOIN
    products p ON pv.product_id = p.id
WHERE
    pv.is_active = TRUE;

COMMENT ON VIEW v_logistics_data IS 
  'Unified logistics data with real weight (not rounded). Shipping cost must be calculated at cart level by summing weights first, then rounding total.';

-- 2. RECREAR v_business_panel_data
-- SIN REDONDEO - El peso real se usa sin CEIL
-- El redondeo SOLO se aplica a nivel de carrito total
-- =============================================================================

CREATE OR REPLACE VIEW v_business_panel_data AS

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

-- ========== RAMA 1: PRODUCTOS ==========
SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  COALESCE(ld.weight_kg, 0) as weight_kg,
  
  -- Costo de envío usando peso REAL sin CEIL (aproximado por unidad)
  (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0)) as shipping_cost_per_unit,
  
  -- PVP sugerido = (precio_b2b × 2.5) + costo_envío (sin redondeo de peso)
  ((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) as suggested_pvp_per_unit,
  
  vp.precio_b2b as investment_1unit,
  ((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) as revenue_1unit,
  (((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vp.precio_b2b) as profit_1unit,
  
  CASE 
    WHEN vp.precio_b2b > 0 THEN ((((vp.precio_b2b * 2.5) + 
      (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
      + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
      + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric(10,1)
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
  
  -- Costo de envío usando peso REAL sin CEIL (aproximado por unidad)
  (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0)) as shipping_cost_per_unit,
  
  ((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) as suggested_pvp_per_unit,
  
  vv.precio_b2b_final as investment_1unit,
  ((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) as revenue_1unit,
  (((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vv.precio_b2b_final) as profit_1unit,
  
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN ((((vv.precio_b2b_final * 2.5) + 
      (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
      + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
      + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vv.is_active,
  NOW() as last_updated

FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_data IS 
  'Business panel with shipping cost per unit using REAL weight (no rounding). Weight rounding ONLY happens at cart total level.';
