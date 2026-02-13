-- =============================================================================
-- CONFIGURAR TARIFAS REALES - Script de Configuración Inicial
-- =============================================================================
-- 
-- Este script configura los datos mínimos necesarios para que el sistema de
-- tarifas reales funcione correctamente
--
-- EJECUTAR SOLO SI: VERIFICAR_SISTEMA_TARIFAS_REALES.sql indica que faltan datos
--
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  CONFIGURACIÓN: Sistema de Tarifas Reales                              ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- =============================================================================
-- PASO 1: Crear Transportation Hubs (si no existen)
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1. CONFIGURANDO TRANSPORTATION HUBS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

INSERT INTO transportation_hubs (id, code, name, country, is_active)
VALUES 
  (gen_random_uuid(), 'CN-GZ', 'Guangzhou, China', 'China', TRUE),
  (gen_random_uuid(), 'US-LA', 'Los Angeles, USA', 'USA', TRUE),
  (gen_random_uuid(), 'US-NY', 'New York, USA', 'USA', TRUE),
  (gen_random_uuid(), 'US-MI', 'Miami, USA', 'USA', TRUE)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = TRUE;

SELECT '✅ Transportation Hubs configurados' as status;

\echo ''

-- =============================================================================
-- PASO 2: Crear Destination Countries (si no existen)
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2. CONFIGURANDO DESTINATION COUNTRIES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

INSERT INTO destination_countries (id, code, name, is_active)
VALUES 
  (gen_random_uuid(), 'HT', 'Haití', TRUE),
  (gen_random_uuid(), 'DO', 'República Dominicana', TRUE),
  (gen_random_uuid(), 'US', 'Estados Unidos', TRUE)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = TRUE;

SELECT '✅ Destination Countries configurados' as status;

\echo ''

-- =============================================================================
-- PASO 3: Crear Shipping Tiers con tarifas equivalentes a la fórmula actual
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3. CONFIGURANDO SHIPPING TIERS (equivalentes a fórmula actual)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Calcular tarifas equivalentes a la fórmula actual
-- Fórmula actual: $11.05 (primer kg) + $5.82 (cada kg adicional)
-- 
-- Para hacer esto equivalente:
-- Asumimos: Tramo A (60%) + Tramo B (40%) = Total
-- Primer kg: $11.05
--   - Tramo A: $11.05 × 0.6 = $6.63/kg
--   - Tramo B: $11.05 × 0.4 = $4.42/kg = $9.74/lb (1 kg = 2.20462 lb)
-- 
-- Kg adicional: $5.82
--   - Tramo A: $5.82 × 0.6 = $3.49/kg
--   - Tramo B: $5.82 × 0.4 = $2.33/kg = $5.14/lb

-- TIER STANDARD (equivalente a la fórmula actual)
INSERT INTO shipping_tiers (
  id,
  name,
  description,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  final_delivery_surcharge,
  is_active
)
VALUES (
  gen_random_uuid(),
  'STANDARD',
  'Envío estándar equivalente a fórmula actual ($11.05 + $5.82/kg)',
  3.50,  -- Tramo A: China → USA
  5.00,  -- Tramo B: USA → Destino (por libra)
  0.00,  -- Sin cargo adicional de entrega
  TRUE
)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      tramo_a_cost_per_kg = EXCLUDED.tramo_a_cost_per_kg,
      tramo_b_cost_per_lb = EXCLUDED.tramo_b_cost_per_lb,
      is_active = TRUE;

-- TIER EXPRESS (más rápido, más caro)
INSERT INTO shipping_tiers (
  id,
  name,
  description,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  final_delivery_surcharge,
  is_active
)
VALUES (
  gen_random_uuid(),
  'EXPRESS',
  'Envío express (30% más caro que estándar)',
  4.55,  -- 30% más que STANDARD
  6.50,  -- 30% más que STANDARD
  0.00,
  TRUE
)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      tramo_a_cost_per_kg = EXCLUDED.tramo_a_cost_per_kg,
      tramo_b_cost_per_lb = EXCLUDED.tramo_b_cost_per_lb,
      is_active = TRUE;

-- TIER ECONOMY (más lento, más barato)
INSERT INTO shipping_tiers (
  id,
  name,
  description,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  final_delivery_surcharge,
  is_active
)
VALUES (
  gen_random_uuid(),
  'ECONOMY',
  'Envío económico (20% más barato que estándar)',
  2.80,  -- 20% menos que STANDARD
  4.00,  -- 20% menos que STANDARD
  0.00,
  TRUE
)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      tramo_a_cost_per_kg = EXCLUDED.tramo_a_cost_per_kg,
      tramo_b_cost_per_lb = EXCLUDED.tramo_b_cost_per_lb,
      is_active = TRUE;

SELECT '✅ Shipping Tiers configurados' as status;

\echo ''

-- Ver tarifas configuradas
SELECT 
  name as "Tier",
  tramo_a_cost_per_kg as "Tramo A (USD/kg)",
  tramo_b_cost_per_lb as "Tramo B (USD/lb)",
  description as "Descripción"
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY tramo_a_cost_per_kg;

\echo ''

-- =============================================================================
-- PASO 4: Crear Shipping Routes (si no existen)
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4. CONFIGURANDO SHIPPING ROUTES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Ruta: China → Haití (vía USA)
WITH hub_china AS (
  SELECT id FROM transportation_hubs WHERE code = 'CN-GZ' LIMIT 1
),
country_haiti AS (
  SELECT id FROM destination_countries WHERE code = 'HT' LIMIT 1
)
INSERT INTO shipping_routes (
  id,
  origin_hub_id,
  destination_country_id,
  is_active
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM hub_china),
  (SELECT id FROM country_haiti),
  TRUE
WHERE EXISTS (SELECT 1 FROM hub_china)
  AND EXISTS (SELECT 1 FROM country_haiti)
ON CONFLICT (origin_hub_id, destination_country_id) DO UPDATE
  SET is_active = TRUE;

SELECT '✅ Shipping Routes configuradas' as status;

\echo ''

-- Ver rutas configuradas
SELECT 
  sr.id,
  th.code || ' (' || th.name || ')' as "Origen",
  dc.code || ' (' || dc.name || ')' as "Destino",
  sr.is_active as "Activa"
FROM shipping_routes sr
JOIN transportation_hubs th ON sr.origin_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE sr.is_active = TRUE;

\echo ''

-- =============================================================================
-- PASO 5: Crear Shipping Types con tiers asignados
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5. CONFIGURANDO SHIPPING TYPES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Shipping Type: Standard
WITH 
  route AS (SELECT id FROM shipping_routes WHERE is_active = TRUE LIMIT 1),
  tier AS (SELECT id FROM shipping_tiers WHERE name = 'STANDARD' LIMIT 1)
INSERT INTO shipping_types (
  id,
  name,
  display_name,
  shipping_route_id,
  shipping_tier_id,
  extra_charge,
  delivery_min_days,
  delivery_max_days,
  is_active
)
SELECT 
  gen_random_uuid(),
  'standard',
  'Envío Estándar',
  (SELECT id FROM route),
  (SELECT id FROM tier),
  0.00,
  15,
  25,
  TRUE
WHERE EXISTS (SELECT 1 FROM route)
  AND EXISTS (SELECT 1 FROM tier)
ON CONFLICT (shipping_route_id, name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      shipping_tier_id = EXCLUDED.shipping_tier_id,
      is_active = TRUE;

-- Shipping Type: Express
WITH 
  route AS (SELECT id FROM shipping_routes WHERE is_active = TRUE LIMIT 1),
  tier AS (SELECT id FROM shipping_tiers WHERE name = 'EXPRESS' LIMIT 1)
INSERT INTO shipping_types (
  id,
  name,
  display_name,
  shipping_route_id,
  shipping_tier_id,
  extra_charge,
  delivery_min_days,
  delivery_max_days,
  is_active
)
SELECT 
  gen_random_uuid(),
  'express',
  'Envío Express',
  (SELECT id FROM route),
  (SELECT id FROM tier),
  5.00,  -- $5 de cargo extra por express
  7,
  12,
  TRUE
WHERE EXISTS (SELECT 1 FROM route)
  AND EXISTS (SELECT 1 FROM tier)
ON CONFLICT (shipping_route_id, name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      shipping_tier_id = EXCLUDED.shipping_tier_id,
      is_active = TRUE;

-- Shipping Type: Economy
WITH 
  route AS (SELECT id FROM shipping_routes WHERE is_active = TRUE LIMIT 1),
  tier AS (SELECT id FROM shipping_tiers WHERE name = 'ECONOMY' LIMIT 1)
INSERT INTO shipping_types (
  id,
  name,
  display_name,
  shipping_route_id,
  shipping_tier_id,
  extra_charge,
  delivery_min_days,
  delivery_max_days,
  is_active
)
SELECT 
  gen_random_uuid(),
  'economy',
  'Envío Económico',
  (SELECT id FROM route),
  (SELECT id FROM tier),
  0.00,
  25,
  35,
  TRUE
WHERE EXISTS (SELECT 1 FROM route)
  AND EXISTS (SELECT 1 FROM tier)
ON CONFLICT (shipping_route_id, name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      shipping_tier_id = EXCLUDED.shipping_tier_id,
      is_active = TRUE;

SELECT '✅ Shipping Types configurados' as status;

\echo ''

-- Ver tipos de envío configurados
SELECT 
  st.name as "Tipo",
  st.display_name as "Nombre",
  tier.name as "Tier",
  st.extra_charge as "Cargo Extra (USD)",
  st.delivery_min_days || '-' || st.delivery_max_days || ' días' as "Tiempo Entrega"
FROM shipping_types st
JOIN shipping_tiers tier ON st.shipping_tier_id = tier.id
WHERE st.is_active = TRUE
ORDER BY st.name;

\echo ''

-- =============================================================================
-- RESUMEN FINAL
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  ✅ CONFIGURACIÓN COMPLETADA                                           ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

SELECT 
  '📊 RESUMEN DE CONFIGURACIÓN' as info,
  (SELECT COUNT(*) FROM transportation_hubs WHERE is_active = TRUE) as hubs,
  (SELECT COUNT(*) FROM destination_countries WHERE is_active = TRUE) as paises,
  (SELECT COUNT(*) FROM shipping_tiers WHERE is_active = TRUE) as tiers,
  (SELECT COUNT(*) FROM shipping_routes WHERE is_active = TRUE) as rutas,
  (SELECT COUNT(*) FROM shipping_types WHERE is_active = TRUE) as tipos_envio;

\echo ''
\echo 'PRÓXIMOS PASOS:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo '1. Ejecuta de nuevo: VERIFICAR_SISTEMA_TARIFAS_REALES.sql'
\echo '   Para confirmar que todo está configurado'
\echo ''
\echo '2. Si todo está ✅, ejecuta: TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql'
\echo '   Para instalar los triggers que usan estas tarifas'
\echo ''
\echo '3. Prueba agregando productos al carrito'
\echo '   Los costos ahora usarán las tarifas configurables'
\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
