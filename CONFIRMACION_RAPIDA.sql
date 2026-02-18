-- ============================================================================
-- ✅ CONFIRMACIÓN RÁPIDA - ¿Está todo correcto?
-- ============================================================================

-- Ver qué columna tiene shipping_tiers
SELECT 
  '🔍 COLUMNA FK EN SHIPPING_TIERS' as verificacion,
  column_name as columna,
  data_type as tipo,
  CASE 
    WHEN column_name = 'route_id' THEN '🎉 ¡PERFECTO! Frontend espera route_id'
    WHEN column_name = 'shipping_route_id' THEN '⚠️ NECESITA CAMBIO a route_id'
    ELSE '❓ Columna desconocida'
  END as estado
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' 
  AND table_schema = 'public'
  AND column_name IN ('route_id', 'shipping_route_id');

-- Decisión final
SELECT 
  '🎯 DECISIÓN' as titulo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'route_id'
    ) THEN '✅ TODO CORRECTO - No necesitas ejecutar ningún fix'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN '⚠️ EJECUTA FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE '❌ ERROR - Columna no encontrada'
  END as resultado;

-- Ver todas las foreign keys de shipping_tiers
SELECT 
  '🔗 FOREIGN KEYS DE SHIPPING_TIERS' as info,
  constraint_name as constraint,
  column_name as columna,
  '→ shipping_routes.id' as apunta_a
FROM information_schema.key_column_usage
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
  AND constraint_name LIKE '%fkey%';
