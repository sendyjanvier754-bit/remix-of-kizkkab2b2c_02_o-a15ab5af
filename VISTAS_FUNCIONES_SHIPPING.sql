-- =============================================================================
-- VISTAS QUE CONSULTAN LAS FUNCIONES RPC DE CÁLCULO DE ENVÍO
-- Fecha: 2026-02-11
-- Propósito: Exponer los datos calculados por las funciones RPC
-- =============================================================================

-- ============================================================================
-- VISTA 1: Costos de envío para productos individuales
-- =============================================================================

CREATE OR REPLACE VIEW v_product_shipping_costs AS

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

SELECT
  p.id as product_id,
  p.nombre as product_name,
  p.sku_interno as sku,
  
  -- Peso (prioridad: weight_kg > peso_kg > weight_g > peso_g)
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  
  -- Datos dimensional
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
  -- Datos de la ruta
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  
  -- ✅ Llamar función calculate_shipping_cost y expandir resultados
  (SELECT weight_kg FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as calculated_weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as base_cost,
  
  (SELECT oversize_surcharge FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as oversize_surcharge,
  
  (SELECT dimensional_surcharge FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as dimensional_surcharge,
  
  (SELECT volume_m3 FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as volume_m3,
  
  (SELECT total_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as total_cost,
  
  p.is_active,
  NOW() as last_updated

FROM public.products p
WHERE p.is_active = TRUE;

COMMENT ON VIEW v_product_shipping_costs IS 
  'Costos de envío para productos individuales, incluyendo costo base, surcharges por oversize y dimensiones. Consulta: calculate_shipping_cost()';

---

-- ============================================================================
-- VISTA 2: Costos de envío para carrito (con opción de tipo de envío)
-- ============================================================================

CREATE OR REPLACE VIEW v_cart_shipping_costs AS

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
),
-- Simulamos carrito: productos más usados en B2B
cart_items AS (
  SELECT 
    p.id as product_id,
    p.nombre,
    p.sku_interno,
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
    p.is_oversize,
    p.length_cm,
    p.width_cm,
    p.height_cm,
    1 as quantity  -- Por defecto 1 unidad
  FROM public.products p
  WHERE p.is_active = TRUE
  ORDER BY p.nombre
  LIMIT 10
)

SELECT
  -- Información del carrito
  COUNT(*) OVER () as total_items,
  SUM(weight_kg * quantity) OVER () as total_weight_kg,
  CEIL(SUM(weight_kg * quantity) OVER ()) as weight_rounded_kg,
  
  -- Datos de la ruta
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  
  -- Tipo de envío (STANDARD por defecto)
  COALESCE(
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    NULL
  ) as shipping_type_id,
  
  -- ✅ Llamar función calculate_shipping_cost_cart y expandir resultados
  (SELECT weight_rounded_kg FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as calculated_weight_rounded_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as base_cost,
  
  (SELECT oversize_surcharge FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as oversize_surcharge,
  
  (SELECT dimensional_surcharge FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as dimensional_surcharge,
  
  (SELECT volume_m3 FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as volume_m3,
  
  (SELECT extra_cost FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as extra_cost,
  
  (SELECT shipping_type_name FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as shipping_type_name,
  
  (SELECT shipping_type_display FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as shipping_type_display,
  
  (SELECT total_cost_with_type FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM default_route_id LIMIT 1),
    SUM(cart_items.weight_kg * cart_items.quantity) OVER (),
    (SELECT id FROM public.shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
    MAX(CASE WHEN cart_items.is_oversize = TRUE THEN TRUE ELSE FALSE END) OVER (),
    MAX(cart_items.length_cm) OVER (),
    MAX(cart_items.width_cm) OVER (),
    MAX(cart_items.height_cm) OVER ()
  )) as total_cost_with_type,
  
  NOW() as last_updated

FROM cart_items;

COMMENT ON VIEW v_cart_shipping_costs IS 
  'Costos de envío para carrito (simulado con 10 productos más usados), incluyendo costo base, surcharges y costo total con tipo de envío. Consulta: calculate_shipping_cost_cart()';

---

-- ============================================================================
-- VERIFICACIÓN: Las dos vistas fueron creadas
-- ============================================================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_type = 'VIEW' 
  AND (table_name = 'v_product_shipping_costs' 
       OR table_name = 'v_cart_shipping_costs')
ORDER BY table_name;

-- ============================================================================
-- PRUEBAS: Ver datos de las vistas
-- ============================================================================

/*
-- Ver costos de envío de productos individuales
SELECT 
  product_id,
  product_name,
  sku,
  weight_kg,
  is_oversize,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  total_cost
FROM v_product_shipping_costs
LIMIT 5;

-- Ver costos de envío del carrito
SELECT 
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  extra_cost,
  total_cost_with_type,
  shipping_type_name
FROM v_cart_shipping_costs
LIMIT 1;
*/
