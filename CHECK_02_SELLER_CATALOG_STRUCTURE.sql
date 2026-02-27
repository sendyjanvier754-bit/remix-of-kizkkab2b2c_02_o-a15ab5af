-- Ver estructura de tabla seller_catalog

SELECT 
  '🔍 TABLA: seller_catalog' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog'
ORDER BY ordinal_position;
