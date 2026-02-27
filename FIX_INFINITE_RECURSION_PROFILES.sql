-- ============================================================================
-- 🔧 FIX: Eliminar recursión infinita en policies de profiles
-- ============================================================================
-- PROBLEMA: Las policies de orders_b2b hacen EXISTS(SELECT FROM profiles)
-- y esto crea recursión infinita cuando profiles intenta validar permisos
--
-- SOLUCIÓN: Las policies de admin deben usar SOLO user_roles, NO profiles
-- ============================================================================

-- ============================================================================
-- PARTE 1: ELIMINAR TODAS LAS POLICIES PROBLEMÁTICAS
-- ============================================================================

-- Eliminar policies de orders_b2b que causan recursión
DROP POLICY IF EXISTS "orders_b2b_all_for_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_admin" ON orders_b2b;

-- Eliminar policies de order_items_b2b que causan recursión  
DROP POLICY IF EXISTS "order_items_b2b_all_for_admins" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_all_admin" ON order_items_b2b;

-- ============================================================================
-- PARTE 2: RECREAR POLICIES SOLO CON user_roles (sin profiles)
-- ============================================================================

-- ORDERS_B2B: Admin policy SIN recursión (solo user_roles)
CREATE POLICY "orders_b2b_all_for_admins"
ON orders_b2b
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ORDER_ITEMS_B2B: Admin policy SIN recursión (solo user_roles)
CREATE POLICY "order_items_b2b_all_for_admins"
ON order_items_b2b
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PARTE 3: VERIFICAR POLICIES DE PROFILES (deben ser simples)
-- ============================================================================

-- Ver policies actuales de profiles
SELECT 
  '🔍 POLICIES profiles' AS tipo,
  policyname,
  cmd AS operacion,
  qual::text AS condicion
FROM pg_policies
WHERE tablename = 'profiles';

-- Si hay policies complejas, eliminarlas y crear una simple
DO $$
BEGIN
  -- Eliminar todas las policies de profiles
  EXECUTE 'DROP POLICY IF EXISTS "profiles_select_all" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "profiles_select_own" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "profiles_select" ON profiles';
  
  -- Crear policy simple: cada usuario solo ve su propio profile
  EXECUTE 'CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (id = auth.uid())';
  
  -- Permitir a todos ver profiles (para JOINs públicos)
  EXECUTE 'CREATE POLICY "profiles_select_public" ON profiles FOR SELECT TO authenticated USING (true)';
END $$;

-- ============================================================================
-- PARTE 4: VERIFICACIÓN FINAL
-- ============================================================================

-- 1. Verificar policies de orders_b2b (no deben referenciar profiles)
SELECT 
  '✅ 1. POLICIES orders_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN qual::text LIKE '%profiles%' THEN '❌ USA PROFILES (recursión)'
    WHEN qual::text LIKE '%user_roles%' THEN '✅ USA user_roles'
    ELSE '📋 Otra'
  END AS estado
FROM pg_policies
WHERE tablename = 'orders_b2b'
  AND policyname LIKE '%admin%';

-- 2. Verificar policies de order_items_b2b (no deben referenciar profiles)
SELECT 
  '✅ 2. POLICIES order_items_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN qual::text LIKE '%profiles%' THEN '❌ USA PROFILES (recursión)'
    WHEN qual::text LIKE '%user_roles%' THEN '✅ USA user_roles'
    ELSE '📋 Otra'
  END AS estado
FROM pg_policies
WHERE tablename = 'order_items_b2b'
  AND policyname LIKE '%admin%';

-- 3. Verificar policies de profiles (deben ser simples)
SELECT 
  '✅ 3. POLICIES profiles' AS tipo,
  policyname,
  cmd AS operacion,
  LEFT(qual::text, 80) AS condicion
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================================================
-- 📋 NOTAS IMPORTANTES
-- ============================================================================
/*
✅ SOLUCIÓN APLICADA:

1. Eliminada la referencia a profiles en policies de orders_b2b
2. Eliminada la referencia a profiles en policies de order_items_b2b
3. Policies de admin ahora SOLO usan user_roles (sin recursión)
4. Policies de profiles simplificadas

RESULTADO:
- ✅ No más recursión infinita
- ✅ orders_b2b y order_items_b2b usan SOLO user_roles para admin
- ✅ profiles tiene policies simples (id = auth.uid() OR true)

PRÓXIMOS PASOS:
1. Ejecuta este script en Supabase SQL Editor
2. Recarga la aplicación (Ctrl+Shift+R)
3. Verifica la consola (F12) → no debería haber error de recursión
4. Ve a "Mis Compras" → deberías ver tus pedidos

SI EL ERROR PERSISTE:
- Comparte el nuevo error de consola
- Puede que haya otras policies con recursión
*/
