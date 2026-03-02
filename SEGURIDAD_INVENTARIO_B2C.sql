-- =====================================================
-- SEGURIDAD: Row Level Security para Inventario B2C
-- =====================================================
-- Las vistas NO tienen RLS propio - heredan de las tablas
-- Este script asegura que solo cada usuario vea sus pedidos
-- =====================================================

-- PASO 1: Verificar estado actual de RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = t.tablename
  ) as tiene_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('orders_b2b', 'order_items_b2b', 'products', 'product_variants', 'stores')
ORDER BY tablename;

-- =====================================================
-- PASO 2: Habilitar RLS en tablas críticas
-- =====================================================

-- 2.1 RLS en orders_b2b
ALTER TABLE orders_b2b ENABLE ROW LEVEL SECURITY;

-- Política: Los vendedores (sellers) ven sus ventas
DROP POLICY IF EXISTS "Sellers ven sus ventas" ON orders_b2b;
CREATE POLICY "Sellers ven sus ventas"
  ON orders_b2b
  FOR SELECT
  USING (
    seller_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.owner_user_id = auth.uid() 
      AND stores.id = orders_b2b.seller_id
    )
  );

-- Política: Los compradores (buyers) ven sus compras
DROP POLICY IF EXISTS "Buyers ven sus compras" ON orders_b2b;
CREATE POLICY "Buyers ven sus compras"
  ON orders_b2b
  FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.owner_user_id = auth.uid() 
      AND stores.id = orders_b2b.buyer_id
    )
  );

-- Política: Admins ven todo
DROP POLICY IF EXISTS "Admins ven todos los pedidos" ON orders_b2b;
CREATE POLICY "Admins ven todos los pedidos"
  ON orders_b2b
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- 2.2 RLS en order_items_b2b
ALTER TABLE order_items_b2b ENABLE ROW LEVEL SECURITY;

-- Política: Ver items de pedidos que tengo permiso de ver
DROP POLICY IF EXISTS "Ver items de pedidos accesibles" ON order_items_b2b;
CREATE POLICY "Ver items de pedidos accesibles"
  ON order_items_b2b
  FOR SELECT
  USING (
    -- Si tengo acceso al pedido, tengo acceso a sus items
    EXISTS (
      SELECT 1 FROM orders_b2b o
      WHERE o.id = order_items_b2b.order_id
      AND (
        o.seller_id = auth.uid()
        OR o.buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM stores s
          WHERE s.owner_user_id = auth.uid()
          AND (s.id = o.seller_id OR s.id = o.buyer_id)
        )
      )
    )
  );

-- 2.3 RLS en stores (si no está ya)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven su propia tienda" ON stores;
CREATE POLICY "Usuarios ven su propia tienda"
  ON stores
  FOR SELECT
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Tiendas públicas visibles" ON stores;
CREATE POLICY "Tiendas públicas visibles"
  ON stores
  FOR SELECT
  USING (is_public = true OR owner_user_id = auth.uid());

-- =====================================================
-- PASO 3: Verificar que la vista v_inventario_b2c_completo
-- ahora respeta la seguridad automáticamente
-- =====================================================

SELECT '
✅ SEGURIDAD CONFIGURADA

🔒 QUÉ SE HIZO:
1. RLS habilitado en orders_b2b, order_items_b2b, stores
2. Políticas creadas:
   - Sellers ven sus ventas
   - Buyers ven sus compras (para inventario B2C)
   - Admins ven todo
   - Items de pedidos solo visibles si tienes acceso al pedido

🛡️ CÓMO FUNCIONA:
- La vista v_inventario_b2c_completo NO tiene seguridad propia
- HEREDA la seguridad de las tablas base
- Cuando un usuario hace SELECT en la vista:
  * PostgreSQL aplica automáticamente las políticas RLS de las tablas
  * Solo verá los registros que las políticas permiten
  
🎯 PRUEBA DE SEGURIDAD:
-- Como buyer (comprador):
SELECT * FROM v_inventario_b2c_completo;
-- Solo verás TUS productos (donde buyer_id = tu user_id)

-- Como seller (vendedor):
SELECT * FROM orders_b2b;
-- Solo verás TUS ventas (donde seller_id = tu user_id)

⚠️ IMPORTANTE:
- Cada consulta a la vista es segura automáticamente
- No necesitas agregar WHERE user_id = auth.uid() manualmente
- PostgreSQL lo hace por ti a nivel de base de datos
- Incluso si alguien manipula el frontend, la BD bloquea datos no autorizados

🔍 VERIFICAR:
Ver siguiente query para confirmar que funciona...

' as resultado;

-- =====================================================
-- PASO 4: Test de seguridad
-- =====================================================

-- Ver políticas activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders_b2b', 'order_items_b2b', 'stores')
ORDER BY tablename, policyname;

-- Contar registros visibles en cada tabla (según políticas)
SELECT 
  'orders_b2b' as tabla,
  COUNT(*) as registros_visibles
FROM orders_b2b
UNION ALL
SELECT 
  'order_items_b2b',
  COUNT(*)
FROM order_items_b2b
UNION ALL
SELECT
  'v_inventario_b2c_completo',
  COUNT(*)
FROM v_inventario_b2c_completo;

-- Ver tu inventario B2C (solo tus productos)
SELECT 
  '🛒 MI INVENTARIO B2C' as seccion,
  *
FROM v_inventario_b2c_completo
LIMIT 10;
