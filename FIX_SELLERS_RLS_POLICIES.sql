-- =====================================================
-- CORREGIR POLÍTICAS RLS PARA TABLA SELLERS
-- =====================================================
-- Asegura que los admins puedan actualizar vendedores
-- =====================================================

-- Ver las políticas actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sellers';

-- Verificar si RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'sellers';

-- =====================================================
-- ELIMINAR POLÍTICAS EXISTENTES Y CREAR NUEVAS
-- =====================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admins pueden actualizar sellers" ON sellers;
DROP POLICY IF EXISTS "Sellers pueden ver su propia información" ON sellers;
DROP POLICY IF EXISTS "Admins pueden ver todos los sellers" ON sellers;
DROP POLICY IF EXISTS "Public puede ver sellers verificados" ON sellers;

-- =====================================================
-- CREAR POLÍTICAS CORRECTAS
-- =====================================================

-- 1. SELECT: Admins pueden ver todos
CREATE POLICY "Admins pueden ver todos los sellers"
ON sellers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 2. SELECT: Sellers pueden ver su propia información
CREATE POLICY "Sellers pueden ver su propia información"
ON sellers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. SELECT: Público puede ver sellers verificados (para marketplace)
CREATE POLICY "Public puede ver sellers verificados"
ON sellers
FOR SELECT
TO public
USING (is_verified = true AND is_active = true);

-- 4. UPDATE: Solo admins pueden actualizar sellers
CREATE POLICY "Admins pueden actualizar sellers"
ON sellers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 5. UPDATE: Sellers pueden actualizar algunos campos propios
CREATE POLICY "Sellers pueden actualizar su información"
ON sellers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. INSERT: Permisos para crear sellers (triggers o admins)
CREATE POLICY "Sistema puede insertar sellers"
ON sellers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver las nuevas políticas
SELECT 
  policyname,
  cmd,
  permissive,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual::text
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check::text
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'sellers'
ORDER BY cmd, policyname;

-- Verificar que RLS está habilitado
SELECT 
  'RLS STATUS: ' || CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'sellers';

-- =====================================================
-- TEST: Verificar permisos del usuario actual
-- =====================================================

-- Verificar si el usuario actual es admin
SELECT 
  id,
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ PUEDE ACTUALIZAR SELLERS'
    ELSE '❌ NO PUEDE ACTUALIZAR SELLERS'
  END as permiso_actualizar
FROM profiles
WHERE id = auth.uid();

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Políticas RLS configuradas correctamente
-- ✅ Admins pueden UPDATE en sellers
-- ✅ Sellers pueden ver y actualizar su propia info
-- ✅ Público puede ver sellers verificados
-- =====================================================
