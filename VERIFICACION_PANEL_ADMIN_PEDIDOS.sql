-- ============================================================================
-- VERIFICACIÓN: PANEL DE ADMINISTRACIÓN - GESTIÓN DE PEDIDOS
-- ============================================================================
-- Este script verifica que los administradores puedan ver y actualizar pedidos
-- ============================================================================

-- ============================================================================
-- PASO 1: Verificar si eres administrador
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email,
  public.is_admin(auth.uid()) as soy_admin,
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) as tengo_rol_admin;

-- Si soy_admin = true, puedes continuar
-- Si soy_admin = false, necesitas que te asignen el rol de admin

-- ============================================================================
-- PASO 2: Ver función is_admin() (debe existir)
-- ============================================================================

SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'is_admin';

-- ============================================================================
-- PASO 3: Verificar políticas RLS para orders_b2b
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual::text as usando_condicion,
  with_check::text as con_verificacion
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY policyname;

-- Deberías ver la política: orders_b2b_all_admin (ALL)
-- Con condición: is_admin(auth.uid())

-- ============================================================================
-- PASO 4: PROBAR como ADMIN - Ver TODOS los pedidos
-- ============================================================================

-- Como admin, deberías ver TODOS los pedidos (no solo los tuyos)
SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at,
  CASE 
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'MIO'
    ELSE 'Otro usuario'
  END as relacion
FROM public.orders_b2b
ORDER BY created_at DESC
LIMIT 20;

-- Si eres admin, deberías ver pedidos de TODOS los usuarios

-- ============================================================================
-- PASO 5: PROBAR como ADMIN - Actualizar estado de pedido
-- ============================================================================

-- Contar pedidos por estado
SELECT 
  status,
  COUNT(*) as cantidad
FROM public.orders_b2b
GROUP BY status
ORDER BY status;

-- Actualizar un pedido de prueba (descomenta para probar)
-- IMPORTANTE: Reemplaza 'ORDER_ID_AQUI' con un ID real del PASO 4
/*
UPDATE public.orders_b2b
SET 
  status = 'paid',
  updated_at = NOW()
WHERE id = 'ORDER_ID_AQUI'::uuid
RETURNING id, status, payment_status, updated_at;
*/

-- Si eres admin, el UPDATE debería funcionar sin error

-- ============================================================================
-- PASO 6: PROBAR como ADMIN - Actualizar payment_status
-- ============================================================================

-- Ver pedidos pendientes de validación
SELECT 
  id,
  seller_id,
  status,
  payment_status,
  total_amount,
  created_at
FROM public.orders_b2b
WHERE payment_status = 'pending_validation'
ORDER BY created_at DESC
LIMIT 10;

-- Confirmar pago manualmente (descomenta para probar)
-- IMPORTANTE: Reemplaza 'ORDER_ID_AQUI' con un ID real
/*
UPDATE public.orders_b2b
SET 
  payment_status = 'paid',
  updated_at = NOW(),
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"admin_validated": true, "validated_at": "' || NOW()::text || '"}'::jsonb
WHERE id = 'ORDER_ID_AQUI'::uuid
RETURNING id, status, payment_status, metadata;
*/

-- ============================================================================
-- PASO 7: RESUMEN de permisos de ADMIN
-- ============================================================================

SELECT 
  'PUEDE ver todos los pedidos' as permiso,
  COUNT(*) as total_pedidos_visibles
FROM public.orders_b2b

UNION ALL

SELECT 
  'PUEDE actualizar pedidos' as permiso,
  CASE 
    WHEN public.is_admin(auth.uid()) THEN 999 
    ELSE 0 
  END as total_pedidos_actualizables;

-- ============================================================================
-- SI NO ERES ADMIN, EJECUTA ESTO PARA CONVERTIRTE EN ADMIN
-- ============================================================================

-- Verificar si ya tienes el rol
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Si no tienes el rol 'admin', necesitas que alguien con permisos ejecute:
/*
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- O si tienes acceso directo a la tabla auth.users, puedes usar el user_id:
/*
INSERT INTO public.user_roles (user_id, role)
VALUES ('TU_USER_ID_AQUI'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- ============================================================================
-- VERIFICAR DESPUÉS DE AGREGAR ROL ADMIN
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email,
  public.is_admin(auth.uid()) as ahora_soy_admin,
  (SELECT COUNT(*) FROM public.orders_b2b) as pedidos_que_puedo_ver;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Si la función is_admin() no existe, crear:
/*
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND role = 'admin'
  )
$$;
*/

-- Si la tabla user_roles no existe, crear:
/*
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios roles
CREATE POLICY "Users can view own roles" 
  ON public.user_roles FOR SELECT 
  USING (user_id = auth.uid());

-- Política para que admins puedan gestionar roles
CREATE POLICY "Admins can manage roles" 
  ON public.user_roles FOR ALL 
  USING (public.is_admin(auth.uid()));
*/

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Si ejecutas PASO 1 y soy_admin = true:
--   ✅ Ya puedes ver y actualizar todos los pedidos en /admin/pedidos
--
-- Si ejecutas PASO 4 y ves pedidos de otros usuarios:
--   ✅ Las políticas RLS de admin están funcionando correctamente
--
-- Si ejecutas PASO 5 UPDATE y funciona:
--   ✅ Puedes actualizar estados de pedidos como admin
--
-- Si todo funciona:
--   ✅ El panel de administración está listo para usar
-- ============================================================================
