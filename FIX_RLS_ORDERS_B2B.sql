-- ============================================================================
-- VERIFICAR Y AGREGAR POLÍTICAS RLS PARA orders_b2b
-- ============================================================================

-- 1. Ver las políticas actuales de orders_b2b
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
WHERE tablename = 'orders_b2b';

-- ============================================================================
-- Si NO hay políticas o no permiten SELECT, ejecutar lo siguiente:
-- ============================================================================

-- 2. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "orders_b2b_select_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_insert_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_seller" ON orders_b2b;

-- 3. Política SELECT: Los sellers pueden ver sus propios pedidos (como seller o buyer)
CREATE POLICY "orders_b2b_select_seller" ON orders_b2b
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- 4. Política INSERT: Los sellers pueden crear pedidos
CREATE POLICY "orders_b2b_insert_seller" ON orders_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- 5. Política UPDATE: Los sellers pueden actualizar sus propios pedidos
CREATE POLICY "orders_b2b_update_seller" ON orders_b2b
FOR UPDATE
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
)
WITH CHECK (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- ============================================================================
-- VERIFICAR POLÍTICAS CREADAS
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'orders_b2b';

-- Deberías ver 3 políticas:
-- 1. orders_b2b_select_seller (SELECT)
-- 2. orders_b2b_insert_seller (INSERT)
-- 3. orders_b2b_update_seller (UPDATE)
