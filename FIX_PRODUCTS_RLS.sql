-- ============================================================================
-- AGREGAR POLÍTICAS RLS PARA products (para que el join funcione)
-- ============================================================================

-- 1. Verificar si products tiene RLS habilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'products';

-- 2. Habilitar RLS si no está habilitado
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas antiguas
DROP POLICY IF EXISTS "products_select_public" ON products;

-- 4. Crear política SELECT para que TODOS puedan ver productos
-- (necesario para que los joins en order_items_b2b funcionen)
CREATE POLICY "products_select_public" ON products
FOR SELECT
TO authenticated
USING (true);  -- Permite ver todos los productos

-- ============================================================================
-- VERIFICAR POLÍTICAS DE products
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'products';

-- ============================================================================
-- Ahora el join en la query de orders_b2b debería funcionar
-- ============================================================================
