-- =============================================================================
-- CORRECCIÓN: Vista v_product_shipping_costs - Versión simplificada
-- Fecha: 2026-02-12
-- IMPORTANTE: Ejecutar SINCRONIZAR_PESO_PRODUCTOS.sql PRIMERO
-- Solución: Usar solo peso_kg y peso_g (ya sincronizados)
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
  
  -- Peso simplificado: Usar solo peso_kg y peso_g (despues de sincronizacion)
  COALESCE(p.peso_kg, p.peso_g / 1000.0, 0) as weight_kg,
  
  -- Datos dimensional
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
  -- Datos de la ruta
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  
  -- Llamar funcion calculate_shipping_cost y expandir resultados
  (SELECT weight_kg FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as calculated_weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as base_cost,
  
  (SELECT oversize_surcharge FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as oversize_surcharge,
  
  (SELECT dimensional_surcharge FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as dimensional_surcharge,
  
  (SELECT volume_m3 FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as volume_m3,
  
  (SELECT total_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0),
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
  'Costos de envío para productos individuales (USA peso_kg y peso_g sincronizados)';

-- =============================================================================
-- VERIFICACIÓN: Consultar productos que antes daban 0
-- =============================================================================

SELECT 
  product_id,
  product_name,
  sku,
  weight_kg as peso_calculado,
  total_cost as costo_logistica
FROM v_product_shipping_costs
WHERE sku IN ('924221472', '2962434831', '758788899')
ORDER BY sku;

-- Debe mostrar:
-- 924221472: peso_calculado = 0.6 kg, costo_logistica > 0
-- 2962434831: peso_calculado = 0.6 kg, costo_logistica > 0
-- 758788899: peso_calculado = ? (depende del peso real)

-- =============================================================================
-- VERIFICACIÓN COMPLETA: Ver todos los productos con logística
-- =============================================================================

SELECT 
  sc.sku,
  sc.nombre,
  vpsc.weight_kg as peso_kg,
  vpsc.total_cost as logistica_calculada,
  sc.costo_logistica as logistica_historica
FROM seller_catalog sc
LEFT JOIN v_product_shipping_costs vpsc 
  ON vpsc.product_id = sc.source_product_id
WHERE sc.is_active = TRUE
ORDER BY sc.nombre
LIMIT 20;
