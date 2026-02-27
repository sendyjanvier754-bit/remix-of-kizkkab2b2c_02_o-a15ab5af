-- ============================================================================
-- PARTE 2: Verificar policies de profiles
-- ============================================================================

SELECT 
  '🔍 POLICIES profiles SELECT' AS tipo,
  policyname,
  cmd AS operacion,
  permissive,
  roles,
  LEFT(qual::text, 100) AS condicion
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;
