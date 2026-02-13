-- =============================================================================
-- BUSCAR TARIFAS (corregido)
-- =============================================================================

-- 1. Primero, ver la estructura real de la tabla
SELECT 
  '📋 COLUMNAS REALES DE SHIPPING_TIERS' as seccion,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver TODAS las filas (sin especificar columnas que no existan)
SELECT 
  '📊 TODAS LAS FILAS EN SHIPPING_TIERS' as seccion,
  *
FROM shipping_tiers
ORDER BY created_at DESC;

-- 3. Contar cuántas hay
SELECT 
  '📈 ESTADÍSTICAS' as seccion,
  COUNT(*) as total_filas,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as activas,
  COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactivas
FROM shipping_tiers;

-- 4. Ver todos los tier_type únicos que existen
SELECT 
  '🏷️ TIPOS DE TIER EXISTENTES' as seccion,
  tier_type,
  COUNT(*) as cantidad
FROM shipping_tiers
GROUP BY tier_type
ORDER BY tier_type;

-- 5. Ver todas las tarifas activas 
SELECT 
  '✅ TODAS LAS TARIFAS ACTIVAS' as seccion,
  tier_type as "Tipo",
  tier_name as "Nombre",
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)"
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY tier_type, tier_name;
