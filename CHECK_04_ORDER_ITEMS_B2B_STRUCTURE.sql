-- Ver estructura de tabla order_items_b2b

SELECT 
  '🔍 TABLA: order_items_b2b' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;
