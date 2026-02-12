-- =============================================================================
-- CALCULAR COSTO PARA 0.3 KG (300g)
-- Fecha: 2026-02-12
-- =============================================================================

-- Opción 1: Crear un producto de prueba temporal
WITH producto_prueba AS (
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid as id,
    'Producto de Prueba 300g' as nombre,
    'TEST-300G' as sku_interno,
    0.3 as peso_kg,
    300 as peso_g,
    FALSE as is_oversize,
    NULL as length_cm,
    NULL as width_cm,
    NULL as height_cm,
    TRUE as is_active
),
route_config AS (
  SELECT sr.id
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
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
  'Producto de 0.3 kg (300g)' as producto,
  0.3 as peso_original_kg,
  
  -- Llamar a la función de cálculo
  (SELECT base_cost FROM calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    0.3,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as costo_base,
  
  (SELECT oversize_surcharge FROM calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    0.3,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as recargo_oversize,
  
  (SELECT dimensional_surcharge FROM calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    0.3,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as recargo_dimensional,
  
  (SELECT total_cost FROM calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    0.3,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as costo_total,
  
  (SELECT weight_kg FROM calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    0.3,
    FALSE,
    NULL,
    NULL,
    NULL
  )) as peso_usado_en_calculo;

-- Comparar con producto de 0.6 kg (600g)
SELECT 
  '0.3 kg vs 0.6 kg' as comparacion;

WITH calculo_03 AS (
  SELECT 
    0.3 as peso,
    (SELECT total_cost FROM calculate_shipping_cost(
      '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
      0.3, FALSE, NULL, NULL, NULL
    )) as costo
),
calculo_06 AS (
  SELECT 
    0.6 as peso,
    (SELECT total_cost FROM calculate_shipping_cost(
      '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid,
      0.6, FALSE, NULL, NULL, NULL
    )) as costo
)
SELECT 
  c03.peso as peso_300g,
  c03.costo as costo_300g,
  c06.peso as peso_600g,
  c06.costo as costo_600g,
  'Si ambos cuestan igual = se redondea al kg completo' as interpretacion
FROM calculo_03 c03, calculo_06 c06;

-- Ver si hay productos de peso similar en la vista
SELECT 
  product_name,
  sku,
  weight_kg as peso_kg,
  total_cost as costo_logistica,
  CASE 
    WHEN weight_kg < 1 THEN 'Menos de 1 kg'
    WHEN weight_kg >= 1 AND weight_kg < 2 THEN '1-2 kg'
    ELSE 'Más de 2 kg'
  END as rango_peso
FROM v_product_shipping_costs
WHERE weight_kg > 0
ORDER BY weight_kg
LIMIT 10;

-- =============================================================================
-- INTERPRETACIÓN:
-- Si 0.3 kg y 0.6 kg cuestan lo mismo ($8.71), significa que se redondea
-- Si 0.3 kg cuesta menos que 0.6 kg, el cálculo es proporcional
-- =============================================================================
