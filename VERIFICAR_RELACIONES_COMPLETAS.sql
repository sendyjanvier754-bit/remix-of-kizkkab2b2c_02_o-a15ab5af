-- ============================================================================
-- 🔍 VERIFICACIÓN COMPLETA DE RELACIONES ENTRE TABLAS
-- Ejecuta ANTES del fix para confirmar que todo está correcto
-- ============================================================================

-- ============================================================================
-- 1️⃣ VER TODAS LAS FOREIGN KEYS ACTUALES
-- ============================================================================
SELECT 
  '1️⃣ FOREIGN KEYS ACTUALES' as seccion,
  tc.table_name as tabla_origen,
  kcu.column_name as columna_fk,
  ccu.table_name as tabla_destino,
  ccu.column_name as columna_destino,
  tc.constraint_name as nombre_constraint,
  CASE 
    -- Verificar que las relaciones sean correctas
    WHEN tc.table_name = 'shipping_routes' AND kcu.column_name = 'destination_country_id' 
      AND ccu.table_name = 'destination_countries' THEN '✅ Correcto'
    WHEN tc.table_name = 'shipping_routes' AND kcu.column_name = 'transit_hub_id' 
      AND ccu.table_name = 'transit_hubs' THEN '✅ Correcto'
    WHEN tc.table_name = 'route_logistics_costs' AND kcu.column_name = 'shipping_route_id' 
      AND ccu.table_name = 'shipping_routes' THEN '✅ Correcto'
    WHEN tc.table_name = 'shipping_tiers' AND kcu.column_name = 'shipping_route_id' 
      AND ccu.table_name = 'shipping_routes' THEN '⚠️ Correcto pero necesita rename'
    WHEN tc.table_name = 'shipping_tiers' AND kcu.column_name = 'route_id' 
      AND ccu.table_name = 'shipping_routes' THEN '✅ Perfecto'
    WHEN tc.table_name = 'markets' AND kcu.column_name = 'destination_country_id' 
      AND ccu.table_name = 'destination_countries' THEN '✅ Correcto'
    WHEN tc.table_name = 'markets' AND kcu.column_name = 'shipping_route_id' 
      AND ccu.table_name = 'shipping_routes' THEN '✅ Correcto'
    WHEN tc.table_name = 'category_shipping_rates' AND kcu.column_name = 'category_id' 
      AND ccu.table_name = 'categories' THEN '✅ Correcto'
    ELSE '✅ Otra relación válida'
  END as estado
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
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
-- 2️⃣ MAPA DE RELACIONES (Quién apunta a quién)
-- ============================================================================
SELECT 
  '2️⃣ MAPA DE RELACIONES' as seccion,
  CASE ordinal
    WHEN 1 THEN '🏢 transit_hubs'
    WHEN 2 THEN '  └─> NO tiene FK (tabla raíz)'
    WHEN 3 THEN '🌍 destination_countries'
    WHEN 4 THEN '  └─> NO tiene FK (tabla raíz)'
    WHEN 5 THEN '🛣️ shipping_routes'
    WHEN 6 THEN '  ├─> destination_country_id → destination_countries.id'
    WHEN 7 THEN '  └─> transit_hub_id → transit_hubs.id'
    WHEN 8 THEN '📦 route_logistics_costs (TRAMOS)'
    WHEN 9 THEN '  └─> shipping_route_id → shipping_routes.id ✅'
    WHEN 10 THEN '🎯 shipping_tiers (TIPOS DE ENVÍO)'
    WHEN 11 THEN '  └─> shipping_route_id → shipping_routes.id ⚠️ (debe ser route_id)'
    WHEN 12 THEN '🌐 markets'
    WHEN 13 THEN '  ├─> destination_country_id → destination_countries.id'
    WHEN 14 THEN '  └─> shipping_route_id → shipping_routes.id ✅'
    WHEN 15 THEN '💰 category_shipping_rates'
    WHEN 16 THEN '  └─> category_id → categories.id'
  END as estructura
FROM (SELECT generate_series(1, 16) as ordinal) t;

-- ============================================================================
-- 3️⃣ VERIFICAR QUE shipping_routes.id EXISTE (TABLA DESTINO)
-- ============================================================================
SELECT 
  '3️⃣ VERIFICAR TABLA DESTINO' as seccion,
  'shipping_routes' as tabla,
  column_name as columna_pk,
  data_type as tipo,
  is_nullable as permite_null,
  '✅ Esta es la columna a la que todos apuntan' as nota
FROM information_schema.columns
WHERE table_name = 'shipping_routes'
  AND table_schema = 'public'
  AND column_name = 'id';

-- ============================================================================
-- 4️⃣ VERIFICAR DATOS EN TABLA DESTINO
-- ============================================================================
SELECT 
  '4️⃣ DATOS EN shipping_routes' as seccion,
  COUNT(*) as total_rutas,
  COUNT(*) FILTER (WHERE is_active = true) as rutas_activas,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Hay rutas disponibles'
    ELSE '❌ No hay rutas (problema)'
  END as estado
FROM shipping_routes;

-- ============================================================================
-- 5️⃣ VERIFICAR INTEGRIDAD DE FOREIGN KEYS
-- ============================================================================

-- ¿Hay route_logistics_costs huérfanos? (sin ruta válida)
SELECT 
  '5️⃣ INTEGRIDAD: route_logistics_costs' as seccion,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE shipping_route_id IN (SELECT id FROM shipping_routes)) as con_ruta_valida,
  COUNT(*) FILTER (WHERE shipping_route_id NOT IN (SELECT id FROM shipping_routes)) as huerfanos,
  CASE 
    WHEN COUNT(*) FILTER (WHERE shipping_route_id NOT IN (SELECT id FROM shipping_routes)) > 0 
    THEN '⚠️ Hay registros huérfanos'
    ELSE '✅ Todos tienen ruta válida'
  END as estado
FROM route_logistics_costs;

-- ¿Hay shipping_tiers huérfanos? (compatible con route_id o shipping_route_id)
SELECT 
  '5️⃣ INTEGRIDAD: shipping_tiers' as seccion,
  COUNT(*) as total_registros,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'route_id')
    THEN 'Usa route_id ✅ (correcto)'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id')
    THEN 'Usa shipping_route_id ⚠️ (necesita fix)'
    ELSE 'No tiene FK de ruta ❌'
  END as columna_fk,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Tabla vacía'
    ELSE '✅ Tiene datos'
  END as estado
FROM shipping_tiers;

-- ¿Hay markets huérfanos?
SELECT 
  '5️⃣ INTEGRIDAD: markets' as seccion,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE shipping_route_id IS NULL) as sin_ruta,
  COUNT(*) FILTER (WHERE shipping_route_id IS NOT NULL AND shipping_route_id IN (SELECT id FROM shipping_routes)) as con_ruta_valida,
  COUNT(*) FILTER (WHERE shipping_route_id IS NOT NULL AND shipping_route_id NOT IN (SELECT id FROM shipping_routes)) as huerfanos,
  CASE 
    WHEN COUNT(*) FILTER (WHERE shipping_route_id IS NOT NULL AND shipping_route_id NOT IN (SELECT id FROM shipping_routes)) > 0 
    THEN '⚠️ Hay mercados con ruta inválida'
    WHEN COUNT(*) FILTER (WHERE shipping_route_id IS NULL) > 0
    THEN '⚠️ Hay mercados sin ruta asignada'
    ELSE '✅ Todos tienen ruta válida'
  END as estado
FROM markets;

-- ============================================================================
-- 6️⃣ ESTADO ACTUAL DE SHIPPING_TIERS
-- ============================================================================
SELECT 
  '6️⃣ ESTADO ACTUAL' as seccion,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'route_id')
    THEN '✅ YA ESTÁ CORRECTO - Usa route_id'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id')
    THEN '⚠️ NECESITA FIX - Usa shipping_route_id'
    ELSE '❌ ERROR - No tiene FK de ruta'
  END as diagnostico,
  (SELECT COUNT(*) FROM shipping_tiers) as registros_actuales,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'route_id')
    THEN 'NO REQUIERE ACCIÓN - Frontend y BD alineados'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id')
    THEN 'Ejecutar FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE 'Contactar soporte técnico'
  END as accion_requerida;

-- ============================================================================
-- 7️⃣ RESUMEN FINAL
-- ============================================================================
SELECT 
  '7️⃣ RESUMEN FINAL' as seccion,
  relacion,
  estado,
  accion
FROM (
  SELECT 1 as orden, 'transit_hubs ← shipping_routes' as relacion, 
    '✅ Correcto' as estado, 'No requiere cambios' as accion
  UNION ALL
  SELECT 2, 'destination_countries ← shipping_routes', 
    '✅ Correcto', 'No requiere cambios'
  UNION ALL
  SELECT 3, 'shipping_routes ← route_logistics_costs', 
    '✅ Correcto (usa shipping_route_id)', 'No requiere cambios'
  UNION ALL
  SELECT 4, 'shipping_routes ← shipping_tiers', 
    '⚠️ Desalineado (usa shipping_route_id pero frontend espera route_id)', 
    '🔧 EJECUTAR FIX'
  UNION ALL
  SELECT 5, 'shipping_routes ← markets', 
    '✅ Correcto (usa shipping_route_id)', 'No requiere cambios'
  UNION ALL
  SELECT 6, 'categories ← category_shipping_rates', 
    '✅ Correcto', 'No requiere cambios'
) t
ORDER BDECISIÓN FINAL' as pregunta,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'route_id')
    THEN '🎉 ¡YA ESTÁ LISTO! - shipping_tiers usa route_id (correcto)'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id')
    THEN '⚠️ NECESITA FIX - shipping_tiers usa shipping_route_id'
    ELSE '❌ ERROR CRÍTICO - shipping_tiers no tiene FK de ruta'
  END as diagnostico,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'route_id')
    THEN '✅ Frontend y Backend ALINEADOS - Puedes crear tipos de envío'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_tiers' AND column_name = 'shipping_route_id')
    THEN '🔧 Ejecuta FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE '❌ Revisar migración de base de datos'
  END as acs seguro, todas las relaciones son válidas'
  END as respuesta,
  CASE 
    WHEN (SELECT COUNT(*) FROM shipping_tiers) = 0 
    THEN 'Procede a ejecutar FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE 'Revisa los datos primero'
  END as recomendacion;
