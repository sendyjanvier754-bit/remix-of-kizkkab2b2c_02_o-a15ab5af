-- Buscar cómo seller_catalog se relaciona con usuarios

-- 1. Ver un ejemplo de seller_catalog con seller_store_id
SELECT 
  '📦 seller_catalog con seller_store_id' as info,
  id,
  seller_store_id,
  nombre
FROM seller_catalog
LIMIT 3;

-- 2. Buscar en orders_b2b cómo se obtiene seller_store_id
SELECT 
  '🔍 orders_b2b estructura' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
  AND (column_name LIKE '%buyer%' OR column_name LIKE '%seller%' OR column_name LIKE '%user%')
ORDER BY ordinal_position;

-- 3. Ver ejemplo de orders_b2b
SELECT 
  '📦 orders_b2b ejemplo' as info,
  id,
  buyer_id,
  status
FROM orders_b2b
LIMIT 3;

-- 4. Verificar si seller_store_id en seller_catalog es directamente un UUID de usuario
-- o si necesita una tabla intermedia
SELECT 
  '🔍 ¿seller_store_id = user_id?' as info,
  sc.seller_store_id,
  COUNT(*) as productos
FROM seller_catalog sc
GROUP BY sc.seller_store_id
LIMIT 5;
