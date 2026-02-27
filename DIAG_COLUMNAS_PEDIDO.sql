-- ============================================================================
-- 🔍 DIAGNOSTICO: Verificar columnas de total_amount y subtotal
-- ============================================================================

-- 1. Columnas de orders_b2b
SELECT 
  '🔍 COLUMNAS orders_b2b' AS tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
  AND column_name IN ('total_amount', 'currency', 'precio_total')
ORDER BY column_name;

-- 2. Columnas de order_items_b2b
SELECT 
  '🔍 COLUMNAS order_items_b2b' AS tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
  AND column_name IN ('subtotal', 'precio_total', 'cantidad', 'quantity')
ORDER BY column_name;

-- 3. Ver datos reales del pedido
SELECT 
  '🔍 DATOS pedido real' AS tipo,
  id,
  status,
  total_amount,
  precio_total,
  currency
FROM orders_b2b
WHERE id = '5bbb1f87-945e-4a5d-9ef9-143fea1405e9'
LIMIT 1;

-- 4. Ver items del pedido
SELECT 
  '🔍 ITEMS del pedido' AS tipo,
  id,
  order_id,
  subtotal,
  precio_total,
  cantidad,
  quantity
FROM order_items_b2b
WHERE order_id = '5bbb1f87-945e-4a5d-9ef9-143fea1405e9'
LIMIT 5;
