-- ============================================================================
-- PARTE 1: Verificar foreign keys de orders_b2b
-- ============================================================================

SELECT 
  '🔍 FOREIGN KEYS orders_b2b' AS tipo,
  tc.constraint_name AS fkey_name,
  kcu.column_name AS columna,
  ccu.table_name AS tabla_referenciada,
  ccu.column_name AS columna_referenciada
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'orders_b2b'
ORDER BY tc.constraint_name;
