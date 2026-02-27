-- Ver todas las columnas de seller_catalog
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog'
ORDER BY ordinal_position;
