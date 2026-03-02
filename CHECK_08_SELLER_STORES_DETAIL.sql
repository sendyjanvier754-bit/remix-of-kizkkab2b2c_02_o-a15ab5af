-- 1. Ver estructura de seller_stores
SELECT 
  '🔍 ESTRUCTURA: seller_stores' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_stores'
ORDER BY ordinal_position;

-- 2. Ver estructura de profiles
SELECT 
  '🔍 ESTRUCTURA: profiles' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Ver todas las tablas con seller_store_id
SELECT 
  '🔍 TABLAS CON seller_store_id' as info,
  table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'seller_store_id'
GROUP BY table_name
ORDER BY table_name;

-- 4. Ver cómo se relacionan users/profiles con seller_stores
SELECT 
  '📦 EJEMPLO: seller_stores' as info,
  id,
  owner_id,
  store_name
FROM seller_stores
LIMIT 3;
