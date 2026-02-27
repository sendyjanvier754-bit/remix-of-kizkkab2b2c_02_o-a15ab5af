-- ============================================================================
-- PARTE 4: Test simple de orders_b2b (sin JOINs)
-- ============================================================================

SELECT 
  '🔍 TEST SIMPLE' AS tipo,
  id,
  status,
  buyer_id,
  seller_id,
  created_at
FROM orders_b2b
WHERE buyer_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
   OR seller_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
LIMIT 5;
