-- ============================================================================
-- VERIFICAR PEDIDO CREADO
-- ============================================================================

-- 1. Ver el pedido que creaste (ID: 7712F7E5)
SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at
FROM orders_b2b
WHERE id::text LIKE '%7712F7E5%'
   OR id::text LIKE '%7712f7e5%';

-- 2. Si no aparece, buscar los últimos 5 pedidos creados
SELECT 
  id,
  seller_id,
  buyer_id, 
  status,
  payment_status,
  total_amount,
  created_at
FROM orders_b2b
ORDER BY created_at DESC
LIMIT 5;

-- 3. Ver tu user_id actual (para verificar que coincide)
SELECT auth.uid() as mi_user_id;

-- ============================================================================
-- El seller_id y buyer_id del pedido deben coincidir con tu user_id
-- ============================================================================
