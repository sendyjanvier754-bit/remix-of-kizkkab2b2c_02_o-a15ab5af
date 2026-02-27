-- ============================================================================
-- 🔧 FIX: RLS de orders_b2b para permitir queries con OR
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- La query del frontend falla con 400 (Bad Request):
--   .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
-- 
-- Esto pasa cuando RLS no permite correctamente las queries con OR

-- ============================================================================
-- PASO 1: Ver RLS policies actuales de orders_b2b
-- ============================================================================

SELECT 
  '🔐 RLS POLICIES' AS tipo,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS comando,
  qual AS condicion_using,
  with_check AS condicion_with_check
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY policyname;

-- ============================================================================
-- PASO 2: Eliminar policies antiguas y crear nuevas SIMPLIFICADAS
-- ============================================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "orders_b2b_select_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_buyer" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_insert_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_all_for_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_operations_admins" ON orders_b2b;

-- ============================================================================
-- ✅ NUEVA POLICY SIMPLIFICADA: Un solo SELECT que permite OR
-- ============================================================================

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

-- DELETE: Solo el seller puede eliminar (opcional, puedes quitarlo si no lo necesitas)
CREATE POLICY "orders_b2b_delete_seller"
ON orders_b2b
FOR DELETE
TO authenticated
USING (
  seller_id = auth.uid()
);

-- ============================================================================
-- ADMINS: Acceso total (IMPORTANTE para panel admin)
-- ============================================================================

CREATE POLICY "orders_b2b_all_for_admins"
ON orders_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PASO 3: Verificar RLS en order_items_b2b
-- ============================================================================

-- Ver policies actuales
SELECT 
  '🔐 RLS order_items_b2b' AS tipo,
  policyname,
  cmd AS comando,
  qual AS condicion
FROM pg_policies
WHERE tablename = 'order_items_b2b';

-- Eliminar policies antiguas de order_items_b2b
DROP POLICY IF EXISTS "order_items_b2b_select_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_insert_user" ON order_items_b2b;
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

-- Admins: acceso total
CREATE POLICY "order_items_b2b_all_for_admins"
ON order_items_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PASO 4: Verificar permisos GRANT en las vistas
-- ============================================================================

-- Asegurar que las vistas tengan permisos
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_variantes_con_precio_b2b TO anon, authenticated;

-- ============================================================================
-- PASO 5: Verificar que profiles tenga permisos
-- ============================================================================

-- Ver policies de profiles
SELECT 
  '🔐 RLS profiles' AS tipo,
  policyname,
  cmd AS comando
FROM pg_policies
WHERE tablename = 'profiles';

-- Si no tiene policy, crear una básica
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

GRANT SELECT ON public.profiles TO anon, authenticated;

-- ============================================================================
-- PASO 6: Verificar que products tenga permisos (para el JOIN)
-- ============================================================================

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

GRANT SELECT ON public.products TO anon, authenticated;

-- ============================================================================
-- ✅ VERIFICACIÓN FINAL
-- ============================================================================

-- Ver todas las policies creadas
SELECT 
  '✅ VERIFICACIÓN' AS tipo,
  tablename,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN qual::text LIKE '%buyer_id = auth.uid() OR seller_id = auth.uid()%' THEN '✅ Permite OR'
    WHEN qual::text LIKE '%buyer_id = auth.uid()%' THEN '⚠️ Solo buyer'
    WHEN qual::text LIKE '%seller_id = auth.uid()%' THEN '⚠️ Solo seller'
    ELSE '📋 Otra condición'
  END AS tipo_policy
FROM pg_policies
WHERE tablename IN ('orders_b2b', 'order_items_b2b', 'profiles', 'products')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 📋 NOTAS IMPORTANTES
-- ============================================================================
/*
✅ CAMBIOS APLICADOS:

1. orders_b2b:
   - SELECT permite ver pedidos donde eres buyer O seller (permite OR query)
   - INSERT solo para seller
   - UPDATE para buyer o seller
   - Admins tienen acceso total

2. order_items_b2b:
   - Hereda permisos del pedido padre (orders_b2b)
   - Solo puedes ver items de pedidos que te pertenecen

3. Vistas:
   - v_productos_con_precio_b2b tiene GRANT SELECT
   - v_variantes_con_precio_b2b tiene GRANT SELECT

4. Tablas auxiliares:
   - profiles y products tienen SELECT público para JOIN

ESTO DEBERÍA SOLUCIONAR:
- ❌ Error 400 en query con OR
- ❌ "Mis Compras" muestra vacío
- ❌ Frontend no puede cargar pedidos

PRÓXIMO PASO:
- Recargar la página (Ctrl+Shift+R)
- Verificar que "Mis Compras" muestre los pedidos
- Si sigue vacío, ejecutar VERIFICAR_VISTAS_EXISTEN.sql para más diagnóstico
*/
