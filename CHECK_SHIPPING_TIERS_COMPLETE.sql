-- ============================================================================
-- VERIFICAR ESTRUCTURA COMPLETA DE shipping_tiers
-- ============================================================================

-- 1. Ver columnas de la tabla
SELECT 
  '📋 Columnas de shipping_tiers' as info,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
ORDER BY ordinal_position;

-- 2. Ver constraints (primary key, foreign keys, unique, etc)
SELECT 
  '🔒 Constraints' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers';

-- 3. Ver índices
SELECT 
  '📇 Índices' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'shipping_tiers';

-- 4. Ver datos existentes (cantidad)
SELECT 
  '📊 Total de registros en shipping_tiers' as info,
  COUNT(*) as total_registros
FROM public.shipping_tiers;

-- 5. Ver todos los datos con relaciones
SELECT 
  '📦 Todos los tiers con info de rutas' as info,
  st.id,
  st.route_id,
  sr.route_name,
  sr.origin_country,
  sr.destination_country,
  st.tier_type,
  st.tier_name,
  st.custom_tier_name,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_cost_per_lb,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max,
  st.is_active,
  st.priority_order,
  st.created_at,
  st.updated_at
FROM public.shipping_tiers st
LEFT JOIN public.shipping_routes sr ON st.route_id = sr.id
ORDER BY sr.route_name, st.priority_order;

-- 6. Ver solo tiers activos
SELECT 
  '✅ Tiers activos' as info,
  COUNT(*) as total_activos
FROM public.shipping_tiers
WHERE is_active = TRUE;

-- 7. Agrupar por ruta
SELECT 
  '📊 Tiers por ruta' as info,
  sr.route_name,
  sr.destination_country,
  COUNT(st.id) as cantidad_tiers,
  string_agg(st.tier_type || ' - ' || COALESCE(st.custom_tier_name, st.tier_name), ', ') as tiers
FROM public.shipping_routes sr
LEFT JOIN public.shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.id, sr.route_name, sr.destination_country
ORDER BY sr.route_name;

-- 8. Verificar si la tabla existe
SELECT 
  '✅ Tabla existe?' as info,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shipping_tiers'
  ) as existe;
