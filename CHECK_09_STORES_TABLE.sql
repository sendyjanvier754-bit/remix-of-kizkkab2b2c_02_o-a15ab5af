-- Ver estructura de tabla stores (no seller_stores)

-- 1. Estructura de stores
SELECT 
  '🔍 ESTRUCTURA: stores' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- 2. Ver datos de ejemplo
SELECT 
  '📦 EJEMPLO: stores' as info,
  *
FROM stores
LIMIT 3;

-- 3. Ver todas las tablas con seller_store_id
SELECT 
  '🔍 TABLAS CON seller_store_id' as info,
  table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'seller_store_id'
GROUP BY table_name
ORDER BY table_name;
