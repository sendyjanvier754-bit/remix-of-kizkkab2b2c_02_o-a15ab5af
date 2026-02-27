-- ============================================================================
-- 🔧 SCRIPT MAESTRO: Agregar role a profiles + Fix RLS completo
-- ============================================================================
-- Este script ejecuta TODO lo necesario para solucionar "Mis Compras":
-- 1. Agrega columna role a profiles
-- 2. Sincroniza con user_roles
-- 3. Crea triggers de sincronización automática
-- 4. Actualiza RLS policies de orders_b2b y order_items_b2b
-- ============================================================================

-- ============================================================================
-- PARTE 1: AGREGAR COLUMNA ROLE A PROFILES
-- ============================================================================

-- Agregar columna role (tipo TEXT)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

COMMENT ON COLUMN public.profiles.role IS 
'Rol principal del usuario (sincronizado desde user_roles). Prioridad: admin > seller > user';

-- ============================================================================
-- PARTE 2: FUNCIÓN PARA OBTENER ROL PRINCIPAL
-- ============================================================================

CREATE OR REPLACE FUNCTION get_primary_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Buscar en orden de prioridad: admin > seller > user
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'seller' THEN 2
      WHEN 'user' THEN 3
      ELSE 4
    END
  LIMIT 1;
  
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 3: SINCRONIZAR ROLES EXISTENTES
-- ============================================================================

-- Actualizar todos los profiles con su rol principal
UPDATE public.profiles p
SET role = get_primary_role(p.id)
WHERE EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
);

-- ============================================================================
-- PARTE 4: CREAR TRIGGERS DE SINCRONIZACIÓN AUTOMÁTICA
-- ============================================================================

-- Función que sincroniza role cuando cambia user_roles
CREATE OR REPLACE FUNCTION sync_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET role = get_primary_role(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.user_id
      ELSE NEW.user_id
    END
  ),
  updated_at = NOW()
  WHERE id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.user_id
    ELSE NEW.user_id
  END;
  
  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS trigger_sync_profile_role ON user_roles;

-- Crear trigger en user_roles
CREATE TRIGGER trigger_sync_profile_role
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_role();

-- Función para inicializar profile con role por defecto
CREATE OR REPLACE FUNCTION init_new_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL THEN
    NEW.role := 'user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS trigger_init_profile_role ON profiles;

-- Crear trigger en profiles
CREATE TRIGGER trigger_init_profile_role
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION init_new_profile_role();

-- ============================================================================
-- PARTE 5: ACTUALIZAR RLS POLICIES DE orders_b2b
-- ============================================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "orders_b2b_select_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_buyer" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_user" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_insert_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_user" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_delete_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_all_for_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_operations_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_for_admins" ON orders_b2b;

-- SELECT: Permite ver pedidos donde eres buyer O seller
CREATE POLICY "orders_b2b_select_user"
ON orders_b2b
FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- INSERT: Solo el seller puede crear pedidos
CREATE POLICY "orders_b2b_insert_seller"
ON orders_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid()
);

-- UPDATE: Tanto buyer como seller pueden actualizar
CREATE POLICY "orders_b2b_update_user"
ON orders_b2b
FOR UPDATE
TO authenticated
USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
)
WITH CHECK (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- DELETE: Solo el seller puede eliminar
CREATE POLICY "orders_b2b_delete_seller"
ON orders_b2b
FOR DELETE
TO authenticated
USING (
  seller_id = auth.uid()
);

-- ADMINS: Acceso total (usa profiles.role + fallback user_roles)
CREATE POLICY "orders_b2b_all_for_admins"
ON orders_b2b
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PARTE 6: ACTUALIZAR RLS POLICIES DE order_items_b2b
-- ============================================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "order_items_b2b_select_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_insert_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_insert_seller" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_update_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_delete_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_all_for_admins" ON order_items_b2b;

-- SELECT: Solo si tienes acceso al pedido padre
CREATE POLICY "order_items_b2b_select_user"
ON order_items_b2b
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- INSERT: Solo si eres el seller del pedido
CREATE POLICY "order_items_b2b_insert_seller"
ON order_items_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND o.seller_id = auth.uid()
  )
);

-- UPDATE: Si eres buyer o seller del pedido
CREATE POLICY "order_items_b2b_update_user"
ON order_items_b2b
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Admins: acceso total (usa profiles.role + fallback user_roles)
CREATE POLICY "order_items_b2b_all_for_admins"
ON order_items_b2b
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PARTE 7: PERMISOS GRANT EN TABLAS
-- ============================================================================

-- Permisos en vistas (ya deberían existir)
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_variantes_con_precio_b2b TO anon, authenticated;

-- Permisos en tablas auxiliares
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;

-- Asegurar policy básica en profiles (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'profiles_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Asegurar policy básica en products (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' 
    AND policyname = 'products_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "products_select_all" ON products FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ============================================================================
-- ✅ VERIFICACIÓN FINAL
-- ============================================================================

-- 1. Verificar columna role en profiles
SELECT 
  '✅ 1. COLUMNA ROLE' AS tipo,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role';

-- 2. Ver algunos perfiles con roles
SELECT 
  '✅ 2. PERFILES' AS tipo,
  p.id,
  LEFT(p.email, 20) AS email,
  p.role AS profile_role,
  STRING_AGG(ur.role::TEXT, ', ') AS user_roles
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
GROUP BY p.id, p.email, p.role
LIMIT 5;

-- 3. Verificar triggers
SELECT 
  '✅ 3. TRIGGERS' AS tipo,
  trigger_name,
  event_manipulation AS evento,
  event_object_table AS tabla
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%profile%role%' OR trigger_name LIKE '%sync%')
ORDER BY event_object_table, trigger_name;

-- 4. Verificar policies de orders_b2b
SELECT 
  '✅ 4. POLICIES orders_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN qual::text LIKE '%buyer_id = auth.uid() OR seller_id = auth.uid()%' THEN '✅ OR'
    WHEN qual::text LIKE '%profiles%role%admin%' THEN '✅ profiles.role'
    ELSE '📋 Otra'
  END AS tipo_policy
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY cmd, policyname;

-- 5. Verificar policies de order_items_b2b
SELECT 
  '✅ 5. POLICIES order_items_b2b' AS tipo,
  policyname,
  cmd AS operacion
FROM pg_policies
WHERE tablename = 'order_items_b2b'
ORDER BY cmd, policyname;

-- ============================================================================
-- 📋 RESULTADO ESPERADO
-- ============================================================================
/*
✅ TODO APLICADO CORRECTAMENTE:

1. Columna role agregada a profiles
2. Roles sincronizados desde user_roles
3. Triggers creados para sincronización automática
4. RLS policies actualizadas para permitir OR queries
5. Admins pueden acceder usando profiles.role

PRÓXIMOS PASOS:
1. Recarga la aplicación (Ctrl+Shift+R)
2. Ve a "Mis Compras" (http://localhost:8080/seller/mis-compras)
3. Deberías ver tus 10 pedidos

SI SIGUE SIN FUNCIONAR:
- Abre F12 → Console
- Busca errores 400/404
- Comparte el mensaje de error exacto
*/
