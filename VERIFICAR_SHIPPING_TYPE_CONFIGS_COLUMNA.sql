-- ============================================================================
-- 🔍 VERIFICAR COLUMNA FK EN SHIPPING_TYPE_CONFIGS
-- ============================================================================
-- Determina si la columna es 'route_id' o 'shipping_route_id'

SELECT 
  '📋 Columnas de shipping_type_configs' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_type_configs'
  AND column_name IN ('route_id', 'shipping_route_id')
ORDER BY ordinal_position;

-- Ver todas las columnas de la tabla
SELECT 
  '📄 TODAS las columnas de shipping_type_configs' as info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_type_configs'
ORDER BY ordinal_position;

-- Verificar foreign keys
SELECT 
  '🔗 Foreign Keys de shipping_type_configs' as info,
  tc.constraint_name,
  kcu.column_name as columna_local,
  ccu.table_name as tabla_referenciada,
  ccu.column_name as columna_referenciada
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'shipping_type_configs'
ORDER BY tc.constraint_name;
