-- Ver columnas de orders_b2b (LO MÁS IMPORTANTE)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders_b2b' AND table_schema = 'public'
ORDER BY ordinal_position;
