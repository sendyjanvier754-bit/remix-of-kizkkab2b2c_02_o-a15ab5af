-- Ver todas las columnas de orders_b2b
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
ORDER BY ordinal_position;
