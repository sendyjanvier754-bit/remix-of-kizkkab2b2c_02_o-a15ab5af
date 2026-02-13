-- =============================================================================
-- BUSCAR TODAS LAS TARIFAS (sin filtros)
-- =============================================================================

-- 1. Ver TODAS las filas en shipping_tiers (sin filtros)
SELECT 
  '📊 TODAS LAS FILAS EN SHIPPING_TIERS' as seccion,
  id,
  route_id,
  tier_type,
  tier_name,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  is_active,
  created_at
FROM shipping_tiers
ORDER BY created_at DESC;

-- 2. Contar cuántas hay
SELECT 
  '📈 ESTADÍSTICAS' as seccion,
  COUNT(*) as total_filas,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as activas,
  COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactivas
FROM shipping_tiers;

-- 3. Ver todos los tier_type únicos que existen
SELECT 
  '🏷️ TIPOS DE TIER EXISTENTES' as seccion,
  tier_type,
  COUNT(*) as cantidad,
  string_agg(tier_name, ', ') as nombres
FROM shipping_tiers
GROUP BY tier_type
ORDER BY tier_type;

-- 4. Ver si hay tarifas con tier_type diferente a 'standard'
SELECT 
  '🔍 TARIFAS NO-STANDARD' as seccion,
  tier_type,
  tier_name,
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)",
  is_active
FROM shipping_tiers
WHERE tier_type != 'standard'
ORDER BY tier_type;

-- 5. Ver todas las tarifas activas (sin importar el tipo)
SELECT 
  '✅ TODAS LAS TARIFAS ACTIVAS' as seccion,
  tier_type as "Tipo",
  tier_name as "Nombre",
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)",
  transport_type as "Transporte"
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY tier_type, tier_name;

-- 6. Verificar la estructura de la tabla
SELECT 
  '📋 COLUMNAS DE SHIPPING_TIERS' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
ORDER BY ordinal_position;
