-- =====================================================
-- VERIFICAR ESTRUCTURA REAL DE ORDERS_B2B
-- =====================================================

-- Ver todas las columnas de orders_b2b
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders_b2b'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver un pedido de ejemplo
SELECT * FROM orders_b2b LIMIT 1;

-- Ver pedidos con diferentes status
SELECT 
  status,
  COUNT(*) as total
FROM orders_b2b
GROUP BY status
ORDER BY status;
