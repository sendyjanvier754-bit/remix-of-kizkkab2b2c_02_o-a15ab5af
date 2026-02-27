-- ============================================================================
-- PARTE 5: Test con JOIN a profiles
-- ============================================================================

SELECT 
  '🔍 TEST JOIN profiles' AS tipo,
  o.id AS order_id,
  o.status,
  p.full_name AS seller_name,
  p.email AS seller_email
FROM orders_b2b o
LEFT JOIN profiles p ON p.id = o.seller_id
WHERE o.buyer_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
   OR o.seller_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
LIMIT 3;
