-- ============================================================================
-- 🔍 VERIFICAR ESTRUCTURA DE route_logistics_costs
-- ============================================================================

-- Ver todas las columnas de route_logistics_costs
SELECT 
  '📋 Columnas de route_logistics_costs' as info,
  column_name as columna,
  data_type as tipo,
  is_nullable as permite_null,
  column_default as valor_default,
  ordinal_position as posicion
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'route_logistics_costs'
ORDER BY ordinal_position;

-- Ver foreign keys
SELECT 
  '🔗 Foreign Keys de route_logistics_costs' as info,
  tc.constraint_name,
  kcu.column_name as columna_local,
  ccu.table_name as tabla_referenciada,
  ccu.column_name as columna_referenciada
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'route_logistics_costs';

-- Ver datos existentes
SELECT 
  '📦 Datos actuales en route_logistics_costs' as info,
  *
FROM route_logistics_costs
LIMIT 5;
