-- =============================================================================
-- VER FÓRMULA DE CÁLCULO DE LOGÍSTICA
-- Fecha: 2026-02-12
-- Propósito: Mostrar la función calculate_shipping_cost() y cómo calcula el costo
-- =============================================================================

-- 1. Ver la definición completa de la función
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'calculate_shipping_cost'
  AND n.nspname = 'public';

-- 2. Ver parámetros de entrada de la función
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'calculate_shipping_cost'
  AND n.nspname = 'public';

-- 3. PROBAR la función con un ejemplo de 0.6 kg (600g)
SELECT 
  '0.6 kg (600g)' as peso_entrada,
  (SELECT base_cost FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    0.6,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as costo_base,
  (SELECT oversize_surcharge FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    0.6,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as recargo_oversize,
  (SELECT dimensional_surcharge FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    0.6,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as recargo_dimensional,
  (SELECT total_cost FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    0.6,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as costo_total,
  (SELECT weight_kg FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    0.6,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as peso_redondeado;

-- 4. Ver configuración de la ruta CHINA → HT
SELECT 
  sr.id,
  th.code as origen,
  dc.code as destino,
  rlc_a.cost_per_kg as tramo_a_china_transit,
  rlc_b.cost_per_kg as tramo_b_transit_haiti,
  sr.is_active
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN route_logistics_costs rlc_a 
  ON rlc_a.shipping_route_id = sr.id AND rlc_a.segment = 'china_to_transit'
LEFT JOIN route_logistics_costs rlc_b 
  ON rlc_b.shipping_route_id = sr.id AND rlc_b.segment = 'transit_to_destination'
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT';

-- 5. Comparar pesos diferentes
SELECT 
  peso_kg,
  (SELECT total_cost FROM calculate_shipping_cost(
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
    peso_kg,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as costo_logistica
FROM (
  VALUES 
    (0.1),
    (0.3),
    (0.5),
    (0.6),
    (1.0),
    (1.5),
    (2.0)
) AS pesos(peso_kg)
ORDER BY peso_kg;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Query 1: Código completo de la función calculate_shipping_cost()
-- Query 2: Parámetros que recibe la función
-- Query 3: Desglose del cálculo para 0.6 kg
-- Query 4: Tarifas configuradas en la ruta CHINA → HT
-- Query 5: Comparación de costos según diferentes pesos
-- =============================================================================
