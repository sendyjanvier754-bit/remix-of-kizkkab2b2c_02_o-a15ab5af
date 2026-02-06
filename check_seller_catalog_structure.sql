-- Verificar estructura de seller_catalog
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'seller_catalog'
ORDER BY ordinal_position;
