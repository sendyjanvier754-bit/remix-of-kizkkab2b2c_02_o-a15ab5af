-- Buscar cómo obtener seller_store_id desde buyer_id

-- Ver si existe una tabla stores con owner_id
SELECT 
  '🔍 ¿Existe tabla stores?' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'stores';

-- Si existe, ver su estructura completa
SELECT 
  '🔍 ESTRUCTURA COMPLETA: stores' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- Ver ejemplo de stores (si existe)
SELECT 
  '📦 EJEMPLO: stores' as info,
  *
FROM stores
LIMIT 2;

-- Ver si profiles tiene seller_store_id
SELECT 
  '🔍 profiles tiene seller_store_id?' as info,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name LIKE '%store%';
