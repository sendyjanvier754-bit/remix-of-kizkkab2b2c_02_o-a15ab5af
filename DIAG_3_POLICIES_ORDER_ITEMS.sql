-- ============================================================================
-- PARTE 3: Verificar policies de order_items_b2b
-- ============================================================================

SELECT 
  '🔍 POLICIES order_items_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  permissive,
  LEFT(qual::text, 80) AS condicion
FROM pg_policies
WHERE tablename = 'order_items_b2b'
ORDER BY cmd, policyname;
