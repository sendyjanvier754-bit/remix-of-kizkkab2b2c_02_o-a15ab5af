-- ============================================================================
-- VERIFICAR PEDIDOS SIN AUTH (para SQL Editor)
-- ============================================================================

-- 1. Buscar el pedido por ID corto (7712F7E5)
SELECT 
  id,
  SUBSTR(id::text, 1, 8) as id_corto,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at
FROM orders_b2b
WHERE UPPER(id::text) LIKE '%7712F7E5%'
ORDER BY created_at DESC;

-- 2. Ver los últimos 10 pedidos creados (sin filtro de usuario)
SELECT 
  id,
  SUBSTR(id::text, 1, 8) as id_corto,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at
FROM orders_b2b
ORDER BY created_at DESC
LIMIT 10;

-- 3. Ver cuántos items tiene el pedido 7712F7E5
SELECT 
  oi.id,
  oi.order_id,
  oi.sku,
  oi.nombre,
  oi.cantidad,
  oi.precio_unitario,
  oi.precio_total
FROM order_items_b2b oi
JOIN orders_b2b o ON o.id = oi.order_id
WHERE UPPER(o.id::text) LIKE '%7712F7E5%';

-- ============================================================================
-- Esto te mostrará los datos reales sin depender de la autenticación
-- ============================================================================
