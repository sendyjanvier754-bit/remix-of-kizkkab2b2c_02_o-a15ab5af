-- ============================================================================
-- VERIFICACIÓN ANTES DE EJECUTAR EL FIX
-- Ejecuta esto PRIMERO para ver exactamente qué se va a cambiar
-- ============================================================================

-- 1. Ver la estructura ACTUAL de shipping_tiers
SELECT 
  '🔍 ESTRUCTURA ACTUAL DE SHIPPING_TIERS' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver TODOS los datos actuales en shipping_tiers
SELECT 
  '📊 DATOS ACTUALES EN SHIPPING_TIERS' as info,
  id,
  shipping_route_id,  -- Esta columna se RENOMBRARÁ a route_id
  tier_type,
  tier_name,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  is_active
FROM shipping_tiers
ORDER BY created_at DESC;

-- 3. Ver que shipping_routes NO se va a tocar
SELECT 
  '✅ SHIPPING_ROUTES PERMANECERÁ IGUAL' as info,
  id,
  destination_country_id,
  transit_hub_id,
  is_direct,
  is_active,
  created_at
FROM shipping_routes
ORDER BY created_at DESC;

-- 4. Ver que route_logistics_costs NO se va a tocar
SELECT 
  '✅ ROUTE_LOGISTICS_COSTS PERMANECERÁ IGUAL' as info,
  id,
  shipping_route_id,  -- Esta columna NO se cambia (sigue igual)
  segment,
  cost_per_kg,
  estimated_days_min,
  estimated_days_max,
  is_active
FROM route_logistics_costs
ORDER BY created_at DESC;

-- 5. Ver que category_shipping_rates NO se va a tocar
SELECT 
  '✅ CATEGORY_SHIPPING_RATES PERMANECERÁ IGUAL' as info,
  id,
  category_id,
  fixed_fee,
  percentage_fee,
  is_active
FROM category_shipping_rates
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar foreign keys ACTUALES
SELECT 
  '🔗 FOREIGN KEYS ACTUALES' as info,
  constraint_name,
  table_name,
  column_name
FROM information_schema.key_column_usage
WHERE table_name IN ('shipping_tiers', 'route_logistics_costs')
  AND constraint_name LIKE '%fkey%'
ORDER BY table_name, constraint_name;

-- ============================================================================
-- RESUMEN DE LO QUE VA A CAMBIAR:
-- ============================================================================
-- ✅ shipping_tiers.shipping_route_id → shipping_tiers.route_id
-- ✅ Índice actualizado para usar route_id
-- ✅ Foreign key actualizado para usar route_id
-- 
-- ❌ NO CAMBIA: shipping_routes (tabla completa)
-- ❌ NO CAMBIA: route_logistics_costs (sigue usando shipping_route_id)
-- ❌ NO CAMBIA: category_shipping_rates (sin cambios)
-- ❌ NO CAMBIA: Los DATOS dentro de shipping_tiers (solo nombre de columna)
-- ============================================================================
