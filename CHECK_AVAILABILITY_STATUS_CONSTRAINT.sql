-- Verificar qué valores acepta availability_status en seller_catalog_variants

SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname LIKE '%availability_status%'
  AND conrelid = 'seller_catalog_variants'::regclass;

-- Ver la estructura de la columna
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'seller_catalog_variants'
  AND column_name = 'availability_status';
