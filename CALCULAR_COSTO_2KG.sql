-- =============================================================================
-- CALCULAR COSTO LOGÍSTICA: 2 KG
-- Fecha: 2026-02-12
-- Propósito: Calcular cuánto cuesta enviar 2 kg con la configuración actual
-- =============================================================================

-- MÉTODO 1: Usar la función calculate_shipping_cost_cart() con 2 kg
-- =============================================================================
WITH route_data AS (
  SELECT sr.id as route_id
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
shipping_type_data AS (
  SELECT id as type_id
  FROM shipping_type_configs
  WHERE type = 'STANDARD' AND is_active = TRUE
  LIMIT 1
)
SELECT 
  'Función calculate_shipping_cost_cart' as fuente,
  weight_rounded_kg as peso_redondeado_kg,
  base_cost as costo_base_usd,
  oversize_surcharge as cargo_oversize_usd,
  dimensional_surcharge as cargo_dimensional_usd,
  extra_cost as costo_extra_usd,
  total_cost_with_type as costo_total_usd,
  shipping_type_display as tipo_envio
FROM calculate_shipping_cost_cart(
  (SELECT route_id FROM route_data),
  2.0,  -- 2 kg
  (SELECT type_id FROM shipping_type_data),
  FALSE,  -- NO es oversize
  NULL,  -- Sin dimensiones específicas
  NULL,
  NULL
);

-- =============================================================================
-- MÉTODO 2: Ver configuración del tipo de envío STANDARD
-- =============================================================================
SELECT 
  'Tipo de Envío STANDARD' as info,
  type as tipo,
  extra_cost_fixed as costo_extra_fijo_usd,
  extra_cost_percent as porcentaje_extra,
  display_name as nombre_mostrar
FROM shipping_type_configs
WHERE type = 'STANDARD' AND is_active = TRUE;

-- =============================================================================
-- RESUMEN: Cálculo completo para 2 kg (usando función)
-- =============================================================================
WITH route_data AS (
  SELECT sr.id as route_id
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
shipping_type_data AS (
  SELECT id as type_id
  FROM shipping_type_configs
  WHERE type = 'STANDARD' AND is_active = TRUE
  LIMIT 1
),
costos AS (
  SELECT 
    weight_rounded_kg,
    base_cost,
    oversize_surcharge,
    dimensional_surcharge,
    extra_cost,
    total_cost_with_type,
    shipping_type_display
  FROM calculate_shipping_cost_cart(
    (SELECT route_id FROM route_data),
    2.0,
    (SELECT type_id FROM shipping_type_data),
    FALSE,
    NULL,
    NULL,
    NULL
  )
)
SELECT 
  '📦 CÁLCULO PARA 2 KG' as titulo,
  2.0 as peso_original_kg,
  weight_rounded_kg as peso_redondeado_kg,
  base_cost as costo_base_usd,
  oversize_surcharge as cargo_oversize_usd,
  dimensional_surcharge as cargo_dimensional_usd,
  extra_cost as costo_extra_usd,
  total_cost_with_type as costo_total_usd,
  shipping_type_display as tipo_envio
FROM costos;

-- =============================================================================
-- RESULTADO ESPERADO:
-- - Peso: 2.0 kg
-- - Costo base: calculado según tarifas configuradas
-- - Cargos adicionales: oversize, dimensional, extra
-- - COSTO TOTAL: base + cargos
-- - Tipo de envío: STANDARD
-- =============================================================================
