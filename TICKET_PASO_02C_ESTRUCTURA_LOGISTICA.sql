-- =============================================================================
-- 🎟️ TICKET #02C: ESTRUCTURA DETALLADA - TABLAS LOGÍSTICAS
-- =============================================================================
-- Ejecuta DESPUÉS de TICKET #02B
-- Verificará: destination_countries, shipping_routes, route_logistics_costs
-- ESTADO: Listo para ejecutar
-- Tiempo estimado: 1 minuto
-- =============================================================================

-- ✅ PASO 1: Estructura de DESTINATION_COUNTRIES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'destination_countries' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver datos
SELECT 
  id,
  name,
  code,
  currency,
  is_active
FROM public.destination_countries
LIMIT 10;

-- ✅ PASO 2: Estructura de SHIPPING_ROUTES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'shipping_routes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver datos
SELECT 
  id,
  destination_country_id,
  transit_hub_id,
  is_direct,
  is_active
FROM public.shipping_routes
LIMIT 10;

-- ✅ PASO 3: Estructura de ROUTE_LOGISTICS_COSTS
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver datos
SELECT 
  id,
  shipping_route_id,
  segment,
  cost_per_kg,
  cost_per_cbm,
  min_cost,
  estimated_days_min,
  estimated_days_max
FROM public.route_logistics_costs
LIMIT 10;

-- ✅ PASO 4: Verificar SHIPPING_TIERS (¿existe?)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_tiers')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as shipping_tiers_resultado;

-- Si existe, mostrar estructura
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Y datos
SELECT * FROM public.shipping_tiers LIMIT 10;

-- =============================================================================
-- CONFIRMACIÓN: 
-- =============================================================================
-- 1. ¿DESTINATION_COUNTRIES tiene qué columnas?
-- 2. ¿SHIPPING_ROUTES tiene qué columnas?
-- 3. ¿ROUTE_LOGISTICS_COSTS tiene qué columnas?
-- 4. ¿Existe SHIPPING_TIERS? (SÍ / NO)
-- 5. Si existe, ¿qué columnas tiene?
-- =============================================================================
