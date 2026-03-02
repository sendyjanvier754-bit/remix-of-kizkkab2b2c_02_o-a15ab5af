-- Buscar la tabla que relaciona usuarios con seller_stores

-- Ver todas las tablas que tienen seller_store_id
SELECT 
  '🔍 TABLAS CON seller_store_id' as info,
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'seller_store_id'
ORDER BY table_name;

-- Ver la tabla seller_stores (si existe)
SELECT 
  '🔍 ESTRUCTURA: seller_stores' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_stores'
ORDER BY ordinal_position;

-- Ver si existe una tabla de usuarios/buyers
SELECT 
  '🔍 TABLAS DE USUARIOS' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%user%' 
    OR table_name LIKE '%buyer%'
    OR table_name LIKE '%profile%'
    OR table_name LIKE '%account%'
  )
ORDER BY table_name;
