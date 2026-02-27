-- Ver estructura de tabla product_variants

SELECT 
  '🔍 TABLA: product_variants' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_variants'
ORDER BY ordinal_position;
