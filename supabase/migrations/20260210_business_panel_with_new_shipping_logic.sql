-- =============================================================================
-- Nuevas vistas para BusinessPanel usando funciones de cálculo de envío mejoradas
-- Fecha: 2026-02-10
-- Descripción: 
--   - v_business_panel_with_shipping_functions: Panel de negocio con calculate_shipping_cost()
--   - v_category_logistics: Simple view para módulo de categoría con costos de envío
-- =============================================================================

-- Configuración de ruta predeterminada (China → Haití)
-- Este UUID debe coincidir con la ruta real en tu BD
-- Ejemplo: '21420dcb-9d8a-4947-8530-aaf3519c9047'
-- Si necesitas usar otra ruta, actualizar el UUID_RUTA constante

-- 1. Vista para BusinessPanel con costos calculados por función
-- Usa calculate_shipping_cost() para cada producto/variante
-- =============================================================================

DROP VIEW IF EXISTS v_business_panel_with_shipping_functions CASCADE;

CREATE OR REPLACE VIEW v_business_panel_with_shipping_functions AS

WITH route_config AS (
  -- Obtener la ruta predeterminada (China → Haití)
  SELECT id
  FROM shipping_routes
  WHERE origin = 'CHINA' 
    AND destination = 'HAITI'
    AND is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
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
  
  -- Costo de envío calculado con la función calculate_shipping_cost()
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )) as shipping_cost_per_unit,
  
  -- PVP sugerido = (precio_b2b × 2.5) + costo_envío
  (vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as suggested_pvp_per_unit,
  
  vp.precio_b2b as investment_1unit,
  (vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as revenue_1unit,
  
  ((vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) - vp.precio_b2b) as profit_1unit,
  
  CASE 
    WHEN vp.precio_b2b > 0 THEN (
      ((vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0) - vp.precio_b2b) / vp.precio_b2b * 100
    )::numeric(10,1)
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
  
  -- Costo de envío calculado con la función calculate_shipping_cost()
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )) as shipping_cost_per_unit,
  
  (vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as suggested_pvp_per_unit,
  
  vv.precio_b2b_final as investment_1unit,
  (vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as revenue_1unit,
  
  ((vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) - vv.precio_b2b_final) as profit_1unit,
  
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN (
      ((vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0) - vv.precio_b2b_final) / vv.precio_b2b_final * 100
    )::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vv.is_active,
  NOW() as last_updated

FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_with_shipping_functions IS 
  'Business panel with shipping costs calculated using calculate_shipping_cost() function for individual products. Real weight used (no rounding at item level).';


-- 2. Vista para categorías - Información simplificada de logística
-- Para mostrar en el módulo de categoría
-- =============================================================================

DROP VIEW IF EXISTS v_category_logistics CASCADE;

CREATE OR REPLACE VIEW v_category_logistics AS

WITH route_config AS (
  SELECT id
  FROM shipping_routes
  WHERE origin = 'CHINA' 
    AND destination = 'HAITI'
    AND is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
  LIMIT 1
)

-- ========== RAMA 1: PRODUCTOS ==========
SELECT
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  'product' as item_type,
  
  -- Peso real
  COALESCE(
    p.weight_kg,
    p.peso_kg,
    p.weight_g / 1000.0,
    p.peso_g / 1000.0,
    0
  ) as weight_kg,
  
  -- Costo de envío para peso real (sin redondear)
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(
      p.weight_kg,
      p.peso_kg,
      p.weight_g / 1000.0,
      p.peso_g / 1000.0,
      0
    )
  )) as shipping_cost,
  
  p.is_active

FROM products p
WHERE p.is_active = TRUE

UNION ALL

-- ========== RAMA 2: VARIANTES ==========
SELECT
  pv.product_id,
  pv.id as variant_id,
  p.nombre || ' - ' || pv.name as item_name,
  pv.sku as sku,
  'variant' as item_type,
  
  COALESCE(
    p.weight_kg,
    p.peso_kg,
    p.weight_g / 1000.0,
    p.peso_g / 1000.0,
    0
  ) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(
      p.weight_kg,
      p.peso_kg,
      p.weight_g / 1000.0,
      p.peso_g / 1000.0,
      0
    )
  )) as shipping_cost,
  
  pv.is_active

FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_category_logistics IS 
  'Category module logistics data with shipping costs calculated using calculate_shipping_cost() function.';

