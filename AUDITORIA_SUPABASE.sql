-- ============================================================================
-- 🔍 AUDITORÍA COMPLETA - VERSION SUPABASE
-- Para ejecutar en Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1️⃣ TRANSIT HUBS
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA TRANSIT_HUBS' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transit_hubs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos
SELECT '📊 DATOS TRANSIT_HUBS' as info, * FROM transit_hubs ORDER BY name;

-- Resumen
SELECT 
  '📈 RESUMEN TRANSIT_HUBS' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos
FROM transit_hubs;

-- ============================================================================
-- 2️⃣ DESTINATION COUNTRIES
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA DESTINATION_COUNTRIES' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'destination_countries' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos
SELECT '📊 DATOS DESTINATION_COUNTRIES' as info, * FROM destination_countries ORDER BY name;

-- Resumen
SELECT 
  '📈 RESUMEN DESTINATION_COUNTRIES' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos
FROM destination_countries;

-- ============================================================================
-- 3️⃣ SHIPPING ROUTES ✅ TABLA CORRECTA
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA SHIPPING_ROUTES' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_routes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos con relaciones
SELECT 
  '📊 DATOS SHIPPING_ROUTES' as info,
  sr.id,
  dc.name as pais_destino,
  dc.code as codigo_pais,
  th.name as hub_transito,
  sr.is_direct,
  sr.is_active,
  sr.created_at
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN transit_hubs th ON sr.transit_hub_id = th.id
ORDER BY sr.created_at DESC;

-- Resumen
SELECT 
  '📈 RESUMEN SHIPPING_ROUTES' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activas,
  COUNT(*) FILTER (WHERE is_direct = true) as directas,
  COUNT(*) FILTER (WHERE is_direct = false) as con_hub
FROM shipping_routes;

-- ============================================================================
-- 4️⃣ ROUTE LOGISTICS COSTS ✅ USA shipping_route_id (CORRECTO)
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA ROUTE_LOGISTICS_COSTS' as info,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name = 'shipping_route_id' THEN '✅ Correcto'
    ELSE ''
  END as nota
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos con relaciones (versión segura - muestra todas las columnas)
SELECT 
  '📊 DATOS ROUTE_LOGISTICS_COSTS' as info,
  rlc.*,
  dc.name as pais_destino
FROM route_logistics_costs rlc
LEFT JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
ORDER BY rlc.created_at DESC;

-- Resumen
SELECT 
  '📈 RESUMEN ROUTE_LOGISTICS_COSTS' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(DISTINCT shipping_route_id) as rutas_con_tramos,
  COUNT(*) FILTER (WHERE segment = 'china_to_transit') as tramo_a,
  COUNT(*) FILTER (WHERE segment = 'transit_to_destination') as tramo_b,
  COUNT(*) FILTER (WHERE segment = 'china_to_destination') as directos
FROM route_logistics_costs;

-- ============================================================================
-- 5️⃣ SHIPPING TIERS ⚠️ VERIFICAR SI USA route_id O shipping_route_id
-- ============================================================================

-- Estructura ACTUAL
SELECT 
  '📋 ESTRUCTURA SHIPPING_TIERS' as info,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name = 'shipping_route_id' THEN '⚠️ Frontend espera route_id'
    WHEN column_name = 'route_id' THEN '✅ Correcto'
    ELSE ''
  END as nota
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar columna FK
SELECT 
  '🔍 VERIFICACIÓN COLUMNA FK' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' AND column_name = 'route_id'
    ) THEN '✅ Usa route_id (correcto)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id'
    ) THEN '⚠️ Usa shipping_route_id (necesita cambio)'
    ELSE '❌ No tiene columna FK'
  END as estado_actual;

-- Datos (versión segura que funciona con cualquier nombre)
SELECT 
  '📊 DATOS SHIPPING_TIERS' as info,
  * 
FROM shipping_tiers
ORDER BY created_at DESC;

-- Resumen
SELECT 
  '📈 RESUMEN SHIPPING_TIERS' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(*) FILTER (WHERE tier_type = 'standard') as standard,
  COUNT(*) FILTER (WHERE tier_type = 'express') as express
FROM shipping_tiers;

-- ============================================================================
-- 6️⃣ MARKETS
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA MARKETS' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'markets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos con relaciones
SELECT 
  '📊 DATOS MARKETS' as info,
  m.id,
  m.name,
  m.code,
  dc.name as pais_destino,
  m.shipping_route_id,
  m.currency,
  m.is_active,
  m.sort_order
FROM markets m
LEFT JOIN destination_countries dc ON m.destination_country_id = dc.id
ORDER BY m.sort_order, m.name;

-- Resumen
SELECT 
  '📈 RESUMEN MARKETS' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(*) FILTER (WHERE shipping_route_id IS NOT NULL) as con_ruta,
  COUNT(*) FILTER (WHERE shipping_route_id IS NULL) as sin_ruta
FROM markets;

-- Mercados sin ruta
SELECT 
  '⚠️ MERCADOS SIN RUTA' as info,
  name,
  code,
  is_active
FROM markets
WHERE shipping_route_id IS NULL;

-- ============================================================================
-- 7️⃣ CATEGORY SHIPPING RATES
-- ============================================================================

-- Estructura
SELECT 
  '📋 ESTRUCTURA CATEGORY_SHIPPING_RATES' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'category_shipping_rates' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos con relaciones (versión segura)
SELECT 
  '📊 DATOS CATEGORY_SHIPPING_RATES' as info,
  csr.*,
  c.name as categoria
FROM category_shipping_rates csr
LEFT JOIN categories c ON csr.category_id = c.id
ORDER BY c.name;

-- Resumen
SELECT 
  '📈 RESUMEN CATEGORY_SHIPPING_RATES' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activas,
  COUNT(DISTINCT category_id) as categorias_con_tarifa
FROM category_shipping_rates;

-- Categorías sin tarifa
SELECT 
  '⚠️ CATEGORÍAS SIN TARIFA' as info,
  c.name as categoria
FROM categories c
LEFT JOIN category_shipping_rates csr ON c.id = csr.category_id
WHERE csr.id IS NULL
ORDER BY c.name;

-- ============================================================================
-- 8️⃣ FOREIGN KEYS
-- ============================================================================

SELECT 
  '🔗 FOREIGN KEYS' as info,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referencias_tabla,
  ccu.column_name AS referencias_columna
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'transit_hubs',
    'destination_countries',
    'shipping_routes',
    'route_logistics_costs',
    'shipping_tiers',
    'markets',
    'category_shipping_rates'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 9️⃣ ÍNDICES
-- ============================================================================

SELECT 
  '📇 ÍNDICES' as info,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'transit_hubs',
    'destination_countries',
    'shipping_routes',
    'route_logistics_costs',
    'shipping_tiers',
    'markets',
    'category_shipping_rates'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- 🔟 RESUMEN GENERAL
-- ============================================================================

SELECT 
  '📊 RESUMEN GENERAL' as info,
  modulo,
  total,
  activos,
  (total - activos) as inactivos
FROM (
  SELECT 'Transit Hubs' as modulo, COUNT(*) as total, 
    COUNT(*) FILTER (WHERE is_active = true) as activos FROM transit_hubs
  UNION ALL
  SELECT 'Destination Countries', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM destination_countries
  UNION ALL
  SELECT 'Shipping Routes', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM shipping_routes
  UNION ALL
  SELECT 'Route Logistics Costs', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM route_logistics_costs
  UNION ALL
  SELECT 'Shipping Tiers', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM shipping_tiers
  UNION ALL
  SELECT 'Markets', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM markets
  UNION ALL
  SELECT 'Category Shipping Rates', COUNT(*), 
    COUNT(*) FILTER (WHERE is_active = true) FROM category_shipping_rates
) t
ORDER BY modulo;

-- ============================================================================
-- ⚠️ PROBLEMAS DETECTADOS
-- ============================================================================

-- Problema 1: Columna en shipping_tiers
SELECT 
  '⚠️ PROBLEMA 1: SHIPPING_TIERS' as alerta,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id'
    ) THEN '⚠️ Usa shipping_route_id (necesita cambio)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' AND column_name = 'route_id'
    ) THEN '✅ Usa route_id (correcto)'
    ELSE '❌ Falta columna FK'
  END as estado,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id'
    ) THEN 'Ejecutar FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE 'No requiere acción'
  END as solucion;

-- Problema 2: Mercados sin ruta
SELECT 
  '⚠️ PROBLEMA 2: MERCADOS SIN RUTA' as alerta,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Acción requerida'
    ELSE '✅ Correcto'
  END as estado
FROM markets
WHERE shipping_route_id IS NULL AND is_active = true;

-- Problema 3: Rutas sin tramos
SELECT 
  '⚠️ PROBLEMA 3: RUTAS SIN TRAMOS' as alerta,
  COUNT(DISTINCT sr.id) as cantidad,
  CASE 
    WHEN COUNT(DISTINCT sr.id) > 0 THEN '⚠️ Acción requerida'
    ELSE '✅ Correcto'
  END as estado
FROM shipping_routes sr
LEFT JOIN route_logistics_costs rlc ON sr.id = rlc.shipping_route_id AND rlc.is_active = true
WHERE sr.is_active = true AND rlc.id IS NULL;

-- Problema 4: Categorías sin tarifa
SELECT 
  '⚠️ PROBLEMA 4: CATEGORÍAS SIN TARIFA' as alerta,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Acción requerida'
    ELSE '✅ Correcto'
  END as estado
FROM categories c
LEFT JOIN category_shipping_rates csr ON c.id = csr.category_id AND csr.is_active = true
WHERE csr.id IS NULL;
