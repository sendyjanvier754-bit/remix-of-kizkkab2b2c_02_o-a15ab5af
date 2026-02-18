-- Ver estructura de destination_countries
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'destination_countries'
ORDER BY ordinal_position;

-- Ver datos de ejemplo
SELECT * FROM destination_countries LIMIT 3;
