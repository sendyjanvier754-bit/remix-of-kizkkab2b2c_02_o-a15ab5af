-- ============================================================================
-- DIAGNÓSTICO: Verificar roles de usuario y políticas RLS
-- ============================================================================

-- 1. Verificar tu usuario actual
SELECT 
  auth.uid() as mi_user_id,
  auth.email() as mi_email;

-- 2. Verificar si tienes rol de admin
SELECT 
  ur.user_id,
  ur.role,
  u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.user_id = auth.uid();

-- 3. Ver todos los usuarios admin
SELECT 
  ur.user_id,
  ur.role,
  u.email,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at DESC;

-- 4. Verificar políticas RLS en markets
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
WHERE tablename = 'markets'
ORDER BY policyname;

-- 5. Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'markets';

-- ============================================================================
-- SOLUCIÓN: Si no tienes rol de admin, ejecuta esto:
-- ============================================================================
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES (auth.uid(), 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
