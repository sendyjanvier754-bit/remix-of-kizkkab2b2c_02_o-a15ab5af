-- =============================================================================
-- 🎟️ TICKET #02: ESTRUCTURA DE TABLAS LOGÍSTICAS (REALES)
-- =============================================================================
-- OBJETIVO: Descubrir estructura exacta de CADA tabla de logística
-- ESTADO: Listo para ejecutar
-- Tiempo estimado: 1 minuto
-- =============================================================================
-- 
-- HALLAZGO TICKET #01:
-- ✅ Tabla: addresses (NO shipping_addresses)
--   - Columnas: id, user_id, label, street_address, city, state, country (TEXT), etc
--   - PROBLEMA: country es TEXT, no destination_country_id UUID
--
-- ✅ Tablas existentes: destination_countries, shipping_routes, route_logistics_costs
--
-- =============================================================================

-- ✅ PASO 1: Inspeccionar tabla ADDRESSES en detalle

SELECT 
  'ADDRESSES' as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_con_direccion
FROM public.addresses;

-- Ver estructura de columnas
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'addresses' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver 5 registros de ejemplo
SELECT 
  id,
  user_id,
  label,
  full_name,
  country,
  city,
  is_default,
  created_at
FROM public.addresses
LIMIT 5;

-- ✅ PASO 2: Inspeccionar tabla DESTINATION_COUNTRIES en detalle

SELECT 
  'DESTINATION_COUNTRIES' as tabla,
  COUNT(*) as total_paises
FROM public.destination_countries;

-- Ver estructura
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

-- ✅ PASO 3: Inspeccionar tabla SHIPPING_ROUTES en detalle

SELECT 
  'SHIPPING_ROUTES' as tabla,
  COUNT(*) as total_rutas
FROM public.shipping_routes;

-- Ver estructura
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

-- ✅ PASO 4: Inspeccionar tabla ROUTE_LOGISTICS_COSTS en detalle

SELECT 
  'ROUTE_LOGISTICS_COSTS' as tabla,
  COUNT(*) as total_tramos
FROM public.route_logistics_costs;

-- Ver estructura
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
  estimated_days_max,
  is_active
FROM public.route_logistics_costs
LIMIT 10;

-- ✅ PASO 5: Inspeccionar tabla SHIPPING_TIERS (si existe)

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_tiers')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as shipping_tiers_existe;

-- Si existe, mostrar estructura
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Y datos
SELECT *
FROM public.shipping_tiers
LIMIT 10;

-- ✅ PASO 6: Verificar tabla TRANSIT_HUBS

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transit_hubs')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as transit_hubs_existe;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transit_hubs' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT *
FROM public.transit_hubs
LIMIT 5;

-- ✅ PASO 7: Inspeccionar tabla B2B_CART_ITEMS

SELECT 
  'B2B_CART_ITEMS' as tabla,
  COUNT(*) as total_items
FROM public.b2b_cart_items;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'b2b_cart_items' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT *
FROM public.b2b_cart_items
LIMIT 5;

-- ✅ PASO 8: Revisar qué columnas tiene PRODUCTS

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ✅ PASO 9: Contar datos en cada tabla logística

SELECT 
  'addresses' as tabla,
  COUNT(*) as registros
FROM public.addresses

UNION ALL

SELECT 'destination_countries', COUNT(*) FROM public.destination_countries
UNION ALL
SELECT 'shipping_routes', COUNT(*) FROM public.shipping_routes
UNION ALL
SELECT 'route_logistics_costs', COUNT(*) FROM public.route_logistics_costs
UNION ALL
SELECT 'transit_hubs', COUNT(*) FROM public.transit_hubs
UNION ALL
SELECT 'b2b_cart_items', COUNT(*) FROM public.b2b_cart_items
UNION ALL
SELECT 'products', COUNT(*) FROM public.products

ORDER BY tabla;

-- =============================================================================
-- 📋 VALIDACIÓN ESPERADA (Responde después de ejecutar):
-- =============================================================================
-- ✅ Ver estructura completa de CADA tabla (columnas, tipos, nullable)
-- ✅ Ver muestras de datos (primeros 10 registros)
-- ✅ Contar registros totales en cada tabla
--
-- CONFIRMACIÓN (responde al asistente):
-- 1. ¿ADDRESSES tiene columna destination_country_id UUID? (SÍ / NO)
-- 2. ¿SHIPPING_TIERS existe? (SÍ / NO)
-- 3. ¿SHIPPING_ROUTES tiene datos? (¿Cuántos registros?)
-- 4. ¿ROUTE_LOGISTICS_COSTS tiene datos? (¿Cuántos registros?)
-- 5. ¿TRANSIT_HUBS tiene datos? (¿Cuántos registros?)
-- =============================================================================
