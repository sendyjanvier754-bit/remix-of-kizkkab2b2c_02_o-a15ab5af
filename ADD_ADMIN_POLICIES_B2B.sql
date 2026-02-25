-- ============================================================================
-- AGREGAR POLÍTICAS RLS PARA ADMINS EN orders_b2b Y order_items_b2b
-- ============================================================================

-- Nota: usa la función is_admin() que ya existe en el sistema

-- ============================================================================
-- POLÍTICAS PARA orders_b2b (ADMINS)
-- ============================================================================

-- 1. Eliminar política admin antigua si existe
DROP POLICY IF EXISTS "orders_b2b_select_admin" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_admin" ON orders_b2b;

-- 2. Crear política para admins (pueden ver TODOS los pedidos)
CREATE POLICY "orders_b2b_all_admin" ON orders_b2b
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- POLÍTICAS PARA order_items_b2b (ADMINS)
-- ============================================================================

-- 3. Eliminar política admin antigua si existe
DROP POLICY IF EXISTS "order_items_b2b_select_admin" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_all_admin" ON order_items_b2b;

-- 4. Crear política para admins (pueden ver y modificar TODOS los items)
CREATE POLICY "order_items_b2b_all_admin" ON order_items_b2b
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- VERIFICAR POLÍTICAS CREADAS
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('orders_b2b', 'order_items_b2b')
ORDER BY tablename, policyname;

-- ============================================================================
-- Deberías ver ahora:
-- orders_b2b: 4 políticas (insert_seller, select_seller, select_admin, update_seller)
-- order_items_b2b: 4 políticas (insert_seller, select_seller, select_admin, update_seller)
-- ============================================================================
