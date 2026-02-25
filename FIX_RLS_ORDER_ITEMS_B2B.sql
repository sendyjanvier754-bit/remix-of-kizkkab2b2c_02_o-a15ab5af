-- ============================================================================
-- AGREGAR POLÍTICAS RLS PARA order_items_b2b
-- ============================================================================
-- Esto permite que los sellers puedan crear items de pedidos

-- 1. Habilitar RLS (si no está habilitado)
ALTER TABLE order_items_b2b ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "order_items_b2b_insert_seller" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_select_seller" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_update_seller" ON order_items_b2b;

-- 3. Política para INSERT: Los sellers pueden crear items de sus propios pedidos
CREATE POLICY "order_items_b2b_insert_seller" ON order_items_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND orders_b2b.seller_id = auth.uid()
  )
);

-- 4. Política para SELECT: Los sellers pueden ver items de sus propios pedidos
CREATE POLICY "order_items_b2b_select_seller" ON order_items_b2b
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
);

-- 5. Política para UPDATE: Los sellers pueden actualizar items de sus propios pedidos
CREATE POLICY "order_items_b2b_update_seller" ON order_items_b2b
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND orders_b2b.seller_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND orders_b2b.seller_id = auth.uid()
  )
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
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'order_items_b2b';

-- ============================================================================
-- DEBERÍAS VER 3 POLÍTICAS:
-- 1. order_items_b2b_insert_seller
-- 2. order_items_b2b_select_seller
-- 3. order_items_b2b_update_seller
-- ============================================================================
