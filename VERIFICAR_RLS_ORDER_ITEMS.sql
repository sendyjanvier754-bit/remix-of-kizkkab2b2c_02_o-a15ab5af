-- =====================================================
-- VERIFICAR POLÍTICAS RLS EN order_items_b2b
-- =====================================================

-- 1️⃣ Ver si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'order_items_b2b';

-- 2️⃣ Ver las políticas actuales
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

-- 3️⃣ Ver permisos en la tabla
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'order_items_b2b';

-- 4️⃣ Intentar INSERT manual para probar
-- (Reemplaza los UUIDs con valores reales)
/*
INSERT INTO order_items_b2b (
  order_id,
  product_id,
  sku,
  nombre,
  cantidad,
  precio_unitario,
  subtotal
) VALUES (
  'UUID-DE-UNA-ORDEN-EXISTENTE',
  NULL,
  'TEST-SKU',
  'Producto de Prueba',
  1,
  10.00,
  10.00
);
*/
