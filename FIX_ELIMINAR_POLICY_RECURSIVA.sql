-- ============================================================================
-- 🔧 ELIMINAR POLICY RECURSIVA: profiles_select_related_orders
-- ============================================================================
-- Esta policy causa recursión infinita porque profiles referencia orders_b2b
-- ============================================================================

-- Eliminar la policy problemática
DROP POLICY IF EXISTS "profiles_select_related_orders" ON profiles;

-- ============================================================================
-- ✅ VERIFICACIÓN: No debe existir profiles_select_related_orders
-- ============================================================================

SELECT 
  '✅ POLICIES profiles (sin recursión)' AS resultado,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN policyname = 'profiles_select_related_orders' THEN '❌ RECURSIVA'
    WHEN qual::text LIKE '%orders_b2b%' THEN '❌ Referencia orders_b2b'
    ELSE '✅ OK'
  END AS estado,
  LEFT(qual::text, 100) AS condicion
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY operacion, policyname;

-- ============================================================================
-- 📋 RESULTADO ESPERADO
-- ============================================================================
/*
✅ POLICIES que deben quedar:
- profiles_select_own (SELECT: id = auth.uid())
- profiles_select_public (SELECT: true) 
- Users can insert their own profile (INSERT)
- Users can update their own profile (UPDATE)

❌ POLICIES eliminadas:
- profiles_select_related_orders (causaba recursión)

PRÓXIMOS PASOS:
1. Recarga la aplicación (Ctrl+Shift+R)
2. Verifica consola F12 → el error de recursión debe desaparecer
3. Ve a "Mis Compras" → deberías ver tus pedidos
*/
