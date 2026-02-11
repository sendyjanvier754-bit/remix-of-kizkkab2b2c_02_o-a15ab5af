-- =============================================================================
-- Vista para BusinessPanel de Carrito usando calculate_shipping_cost_cart()
-- Fecha: 2026-02-10
-- Descripción:
--   - v_business_panel_cart_summary: Para resumen de carrito con pesos y costos totales
-- =============================================================================

-- Esta vista es para uso con calculate_shipping_cost_cart() en el carrito
-- Se debe usar con:
--   1. Obtener items del carrito
--   2. Sumar pesos reales (sin redondeo)
--   3. Llamar a la función RPC calculate_shipping_cost_cart(route_id, total_weight_kg, shipping_type_id)

-- La vista en sí no calcula el carrito porque necesita datos dinámicos
-- En su lugar proporcionamos una vista de referencia para productos/variantes simples

DROP VIEW IF EXISTS v_business_panel_cart_summary CASCADE;

CREATE OR REPLACE VIEW v_business_panel_cart_summary AS

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

-- Esta vista devuelve información básica de productos con peso
-- El cálculo del carrito debe hacerse en la aplicación llamando a calculate_shipping_cost_cart()
SELECT
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  'product' as item_type,
  p.precio_b2b as cost_per_unit,
  
  COALESCE(
    p.weight_kg,
    p.peso_kg,
    p.weight_g / 1000.0,
    p.peso_g / 1000.0,
    0
  ) as weight_kg,
  
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  p.is_active

FROM products p
WHERE p.is_active = TRUE

UNION ALL

SELECT
  pv.product_id,
  pv.id as variant_id,
  p.nombre || ' - ' || pv.name as item_name,
  pv.sku as sku,
  'variant' as item_type,
  pv.precio_b2b_final as cost_per_unit,
  
  COALESCE(
    p.weight_kg,
    p.peso_kg,
    p.weight_g / 1000.0,
    p.peso_g / 1000.0,
    0
  ) as weight_kg,
  
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  pv.is_active

FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_cart_summary IS 
  'Cart summary data with route information. Use with calculate_shipping_cost_cart() RPC function for shipping calculations.';

