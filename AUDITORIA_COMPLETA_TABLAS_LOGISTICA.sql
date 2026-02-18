-- ============================================================================
-- 🔍 AUDITORÍA COMPLETA DE ESTRUCTURA Y DATOS - MÓDULO DE LOGÍSTICA
-- ============================================================================
-- Ejecuta este SQL completo para ver toda la estructura actual y verificar
-- que todo esté alineado entre frontend y backend
-- ============================================================================

\echo '════════════════════════════════════════════════════════════════════════════'
\echo '📊 AUDITORÍA COMPLETA - MÓDULO DE LOGÍSTICA'
\echo '════════════════════════════════════════════════════════════════════════════'

-- ============================================================================
-- 1️⃣ TRANSIT HUBS (Hubs de Tránsito)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '1️⃣  TRANSIT_HUBS - Hubs de Tránsito'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE TRANSIT_HUBS' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transit_hubs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales
SELECT 
  '📊 DATOS ACTUALES EN TRANSIT_HUBS' as info,
  id,
  name,
  code,
  description,
  is_active,
  created_at,
  updated_at
FROM transit_hubs
ORDER BY name;

-- Resumen
SELECT 
  '📈 RESUMEN TRANSIT_HUBS' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(*) FILTER (WHERE is_active = false) as inactivos
FROM transit_hubs;

-- ============================================================================
-- 2️⃣ DESTINATION COUNTRIES (Países de Destino)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '2️⃣  DESTINATION_COUNTRIES - Países de Destino'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE DESTINATION_COUNTRIES' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'destination_countries'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales
SELECT 
  '📊 DATOS ACTUALES EN DESTINATION_COUNTRIES' as info,
  id,
  name,
  code,
  currency,
  is_active,
  created_at,
  updated_at
FROM destination_countries
ORDER BY name;

-- Resumen
SELECT 
  '📈 RESUMEN DESTINATION_COUNTRIES' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(*) FILTER (WHERE is_active = false) as inactivos
FROM destination_countries;

-- ============================================================================
-- 3️⃣ SHIPPING ROUTES (Rutas de Envío) ✅ CORRECTO
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '3️⃣  SHIPPING_ROUTES - Rutas de Envío (Tabla Correcta ✅)'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE SHIPPING_ROUTES' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'shipping_routes'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales con relaciones
SELECT 
  '📊 DATOS ACTUALES EN SHIPPING_ROUTES' as info,
  sr.id,
  dc.name as pais_destino,
  dc.code as codigo_pais,
  th.name as hub_transito,
  sr.is_direct as es_directo,
  sr.is_active as activo,
  sr.created_at
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN transit_hubs th ON sr.transit_hub_id = th.id
ORDER BY sr.created_at DESC;

-- Resumen
SELECT 
  '📈 RESUMEN SHIPPING_ROUTES' as info,
  COUNT(*) as total_rutas,
  COUNT(*) FILTER (WHERE is_active = true) as rutas_activas,
  COUNT(*) FILTER (WHERE is_direct = true) as rutas_directas,
  COUNT(*) FILTER (WHERE is_direct = false) as rutas_con_hub
FROM shipping_routes;

-- ============================================================================
-- 4️⃣ ROUTE LOGISTICS COSTS (Costos por Tramo) ✅ CORRECTO
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '4️⃣  ROUTE_LOGISTICS_COSTS - Costos por Tramo (Tabla Correcta ✅)'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE ROUTE_LOGISTICS_COSTS' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales con relaciones
SELECT 
  '📊 DATOS ACTUALES EN ROUTE_LOGISTICS_COSTS' as info,
  rlc.id,
  rlc.shipping_route_id,  -- ✅ Usa shipping_route_id (correcto)
  dc.name as pais_destino,
  rlc.segment as tramo,
  rlc.cost_per_kg,
  rlc.cost_per_cbm,
  rlc.min_cost,
  rlc.estimated_days_min,
  rlc.estimated_days_max,
  rlc.is_active,
  rlc.created_at
FROM route_logistics_costs rlc
LEFT JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
ORDER BY rlc.created_at DESC;

-- Resumen
SELECT 
  '📈 RESUMEN ROUTE_LOGISTICS_COSTS' as info,
  COUNT(*) as total_tramos,
  COUNT(*) FILTER (WHERE is_active = true) as tramos_activos,
  COUNT(DISTINCT shipping_route_id) as rutas_con_tramos,
  COUNT(*) FILTER (WHERE segment = 'china_to_transit') as tramo_a,
  COUNT(*) FILTER (WHERE segment = 'transit_to_destination') as tramo_b,
  COUNT(*) FILTER (WHERE segment = 'china_to_destination') as directos
FROM route_logistics_costs;

-- ============================================================================
-- 5️⃣ SHIPPING TIERS (Tipos de Envío) ⚠️ NECESITA FIX
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '5️⃣  SHIPPING_TIERS - Tipos de Envío (⚠️ NECESITA FIX)'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura ACTUAL de la tabla
SELECT 
  '📋 ESTRUCTURA ACTUAL DE SHIPPING_TIERS' as info,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name = 'shipping_route_id' THEN '⚠️ DEBE CAMBIARSE A route_id'
    WHEN column_name = 'route_id' THEN '✅ CORRECTO'
    ELSE ''
  END as nota
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar qué columna existe actualmente
SELECT 
  '🔍 VERIFICACIÓN DE COLUMNA FK' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'route_id'
    ) THEN '✅ Existe route_id (correcto)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN '⚠️ Existe shipping_route_id (necesita cambio a route_id)'
    ELSE '❌ No existe ninguna columna FK de ruta'
  END as estado_actual;

-- Intentar mostrar datos (ajusta el nombre de columna según lo que existe)
-- Si existe shipping_route_id:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id'
  ) THEN
    RAISE NOTICE '📊 DATOS CON shipping_route_id (nombre actual):';
    PERFORM * FROM (
      SELECT 
        st.id,
        st.shipping_route_id,  -- Nombre actual
        dc.name as pais_destino,
        st.tier_type,
        st.tier_name,
        st.transport_type,
        st.tramo_a_cost_per_kg,
        st.tramo_b_cost_per_lb,
        st.is_active,
        st.priority_order,
        st.created_at
      FROM shipping_tiers st
      LEFT JOIN shipping_routes sr ON st.shipping_route_id = sr.id
      LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
      ORDER BY st.created_at DESC
    ) AS datos;
  END IF;
END $$;

-- Si existe route_id:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_tiers' AND column_name = 'route_id'
  ) THEN
    RAISE NOTICE '📊 DATOS CON route_id (nombre correcto):';
    PERFORM * FROM (
      SELECT 
        st.id,
        st.route_id,  -- Nombre correcto
        dc.name as pais_destino,
        st.tier_type,
        st.tier_name,
        st.transport_type,
        st.tramo_a_cost_per_kg,
        st.tramo_b_cost_per_lb,
        st.is_active,
        st.priority_order,
        st.created_at
      FROM shipping_tiers st
      LEFT JOIN shipping_routes sr ON st.route_id = sr.id
      LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
      ORDER BY st.created_at DESC
    ) AS datos;
  END IF;
END $$;

-- Resumen
SELECT 
  '📈 RESUMEN SHIPPING_TIERS' as info,
  COUNT(*) as total_tiers,
  COUNT(*) FILTER (WHERE is_active = true) as tiers_activos,
  COUNT(*) FILTER (WHERE tier_type = 'standard') as tipo_standard,
  COUNT(*) FILTER (WHERE tier_type = 'express') as tipo_express
FROM shipping_tiers;

-- ============================================================================
-- 6️⃣ MARKETS (Mercados)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '6️⃣  MARKETS - Mercados'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE MARKETS' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'markets'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales con relaciones
SELECT 
  '📊 DATOS ACTUALES EN MARKETS' as info,
  m.id,
  m.name,
  m.code,
  dc.name as pais_destino,
  m.shipping_route_id,  -- ✅ Usa shipping_route_id (correcto para markets)
  m.currency,
  m.is_active,
  m.sort_order,
  m.created_at
FROM markets m
LEFT JOIN destination_countries dc ON m.destination_country_id = dc.id
ORDER BY m.sort_order, m.name;

-- Resumen
SELECT 
  '📈 RESUMEN MARKETS' as info,
  COUNT(*) as total_mercados,
  COUNT(*) FILTER (WHERE is_active = true) as mercados_activos,
  COUNT(*) FILTER (WHERE shipping_route_id IS NOT NULL) as con_ruta_asignada,
  COUNT(*) FILTER (WHERE shipping_route_id IS NULL) as sin_ruta
FROM markets;

-- Mercados sin ruta asignada (⚠️ alerta)
SELECT 
  '⚠️ MERCADOS SIN RUTA ASIGNADA' as info,
  name,
  code,
  is_active
FROM markets
WHERE shipping_route_id IS NULL;

-- ============================================================================
-- 7️⃣ CATEGORY SHIPPING RATES (Tarifas por Categoría)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '7️⃣  CATEGORY_SHIPPING_RATES - Tarifas por Categoría'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Estructura de la tabla
SELECT 
  '📋 ESTRUCTURA DE CATEGORY_SHIPPING_RATES' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'category_shipping_rates'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Datos actuales con relaciones
SELECT 
  '📊 DATOS ACTUALES EN CATEGORY_SHIPPING_RATES' as info,
  csr.id,
  c.name as categoria,
  csr.fixed_fee,
  csr.percentage_fee,
  csr.is_active,
  csr.created_at
FROM category_shipping_rates csr
LEFT JOIN categories c ON csr.category_id = c.id
ORDER BY c.name;

-- Resumen
SELECT 
  '📈 RESUMEN CATEGORY_SHIPPING_RATES' as info,
  COUNT(*) as total_tarifas,
  COUNT(*) FILTER (WHERE is_active = true) as tarifas_activas,
  COUNT(DISTINCT category_id) as categorias_con_tarifa
FROM category_shipping_rates;

-- Categorías sin tarifa (⚠️ alerta)
SELECT 
  '⚠️ CATEGORÍAS SIN TARIFA ASIGNADA' as info,
  c.name as categoria,
  c.id
FROM categories c
LEFT JOIN category_shipping_rates csr ON c.id = csr.category_id
WHERE csr.id IS NULL
ORDER BY c.name;

-- ============================================================================
-- 8️⃣ FOREIGN KEYS (Relaciones)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '8️⃣  FOREIGN KEYS - Relaciones entre Tablas'
\echo '────────────────────────────────────────────────────────────────────────────'

SELECT 
  '🔗 FOREIGN KEYS ACTUALES' as info,
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
-- 9️⃣ ÍNDICES (Performance)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '9️⃣  ÍNDICES - Performance de Consultas'
\echo '────────────────────────────────────────────────────────────────────────────'

SELECT 
  '📇 ÍNDICES ACTUALES' as info,
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
-- 🔟 VISTAS (Views)
-- ============================================================================
\echo ''
\echo '────────────────────────────────────────────────────────────────────────────'
\echo '🔟 VISTAS - Views del Sistema'
\echo '────────────────────────────────────────────────────────────────────────────'

-- Verificar si existe markets_dashboard
SELECT 
  '🔍 VERIFICACIÓN DE VISTA MARKETS_DASHBOARD' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'markets_dashboard'
    ) THEN '✅ Vista existe'
    ELSE '❌ Vista NO existe (⚠️ necesaria para frontend)'
  END as estado;

-- Si existe, mostrar su definición
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'markets_dashboard'
  ) THEN
    RAISE NOTICE 'Mostrando datos de markets_dashboard...';
  END IF;
END $$;

-- Mostrar datos de la vista si existe
SELECT 
  '📊 DATOS EN MARKETS_DASHBOARD' as info,
  *
FROM markets_dashboard
ORDER BY sort_order, name
LIMIT 10;

-- ============================================================================
-- ✅ RESUMEN GENERAL
-- ============================================================================
\echo ''
\echo '════════════════════════════════════════════════════════════════════════════'
\echo '✅ RESUMEN GENERAL DE AUDITORÍA'
\echo '════════════════════════════════════════════════════════════════════════════'

WITH resumen AS (
  SELECT 
    'Transit Hubs' as modulo,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as activos
  FROM transit_hubs
  
  UNION ALL
  
  SELECT 
    'Destination Countries',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM destination_countries
  
  UNION ALL
  
  SELECT 
    'Shipping Routes',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM shipping_routes
  
  UNION ALL
  
  SELECT 
    'Route Logistics Costs',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM route_logistics_costs
  
  UNION ALL
  
  SELECT 
    'Shipping Tiers',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM shipping_tiers
  
  UNION ALL
  
  SELECT 
    'Markets',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM markets
  
  UNION ALL
  
  SELECT 
    'Category Shipping Rates',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  FROM category_shipping_rates
)
SELECT 
  '📊 RESUMEN POR MÓDULO' as info,
  modulo,
  total,
  activos,
  (total - activos) as inactivos,
  ROUND((activos::numeric / NULLIF(total, 0) * 100), 2) as porcentaje_activos
FROM resumen
ORDER BY modulo;

-- ============================================================================
-- ⚠️ ALERTAS Y PROBLEMAS DETECTADOS
-- ============================================================================
\echo ''
\echo '════════════════════════════════════════════════════════════════════════════'
\echo '⚠️  ALERTAS Y PROBLEMAS DETECTADOS'
\echo '════════════════════════════════════════════════════════════════════════════'

-- Problema 1: Nombre de columna en shipping_tiers
SELECT 
  '⚠️ PROBLEMA 1: SHIPPING_TIERS' as alerta,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN '⚠️ Usa shipping_route_id pero frontend espera route_id'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'route_id'
    ) THEN '✅ Usa route_id (correcto)'
    ELSE '❌ Falta columna FK de ruta'
  END as estado,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN 'Ejecutar FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE 'No requiere acción'
  END as solucion;

-- Problema 2: Mercados sin ruta
SELECT 
  '⚠️ PROBLEMA 2: MERCADOS SIN RUTA' as alerta,
  COUNT(*) as cantidad_mercados,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Hay mercados sin ruta asignada'
    ELSE '✅ Todos los mercados tienen ruta'
  END as estado,
  CASE 
    WHEN COUNT(*) > 0 THEN 'Asignar rutas en AdminMarketsPage'
    ELSE 'No requiere acción'
  END as solucion
FROM markets
WHERE shipping_route_id IS NULL
  AND is_active = true;

-- Problema 3: Rutas sin tramos
SELECT 
  '⚠️ PROBLEMA 3: RUTAS SIN TRAMOS' as alerta,
  COUNT(DISTINCT sr.id) as cantidad_rutas,
  CASE 
    WHEN COUNT(DISTINCT sr.id) > 0 THEN '⚠️ Hay rutas activas sin costos de tramo'
    ELSE '✅ Todas las rutas tienen tramos'
  END as estado,
  CASE 
    WHEN COUNT(DISTINCT sr.id) > 0 THEN 'Configurar tramos en AdminGlobalLogisticsPage'
    ELSE 'No requiere acción'
  END as solucion
FROM shipping_routes sr
LEFT JOIN route_logistics_costs rlc ON sr.id = rlc.shipping_route_id AND rlc.is_active = true
WHERE sr.is_active = true
  AND rlc.id IS NULL;

-- Problema 4: Categorías sin tarifa
SELECT 
  '⚠️ PROBLEMA 4: CATEGORÍAS SIN TARIFA' as alerta,
  COUNT(*) as cantidad_categorias,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Hay categorías sin tarifa de envío'
    ELSE '✅ Todas las categorías tienen tarifa'
  END as estado,
  CASE 
    WHEN COUNT(*) > 0 THEN 'Configurar tarifas en AdminGlobalLogisticsPage'
    ELSE 'No requiere acción'
  END as solucion
FROM categories c
LEFT JOIN category_shipping_rates csr ON c.id = csr.category_id AND csr.is_active = true
WHERE csr.id IS NULL;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════════'
\echo '✅ AUDITORÍA COMPLETA TERMINADA'
\echo '════════════════════════════════════════════════════════════════════════════'
\echo ''
\echo 'PRÓXIMOS PASOS:'
\echo '1. Revisar alertas y problemas detectados'
\echo '2. Si shipping_tiers usa shipping_route_id, ejecutar FIX_SHIPPING_TIERS_AHORA.sql'
\echo '3. Asignar rutas a mercados sin ruta'
\echo '4. Configurar tramos para rutas sin costos'
\echo '5. Configurar tarifas para categorías sin tarifa'
\echo ''
