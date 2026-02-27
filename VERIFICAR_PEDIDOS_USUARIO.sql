-- ============================================================================
-- 🔍 DIAGNÓSTICO: ¿Hay pedidos del usuario actual?
-- ============================================================================
-- Ejecuta esto para ver si realmente tienes pedidos asignados

-- PASO 1: Ver tu user_id
SELECT 
  'MI USER ID' AS info,
  auth.uid() AS mi_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS mi_email;

-- PASO 2: Ver TODOS los pedidos recientes sin filtro RLS
SELECT 
  'TODOS LOS PEDIDOS' AS info,
  o.id,
  o.buyer_id,
  o.seller_id,
  o.status,
  o.total_amount,
  o.created_at,
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ SOY BUYER'
    WHEN o.seller_id = auth.uid() THEN '✅ SOY SELLER'  
    ELSE '❌ NO SOY YO'
  END AS relacion,
  COUNT(oi.id) AS items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.buyer_id, o.seller_id, o.status, o.total_amount, o.created_at
ORDER BY o.created_at DESC
LIMIT 10;

-- PASO 3: Query exacta del frontend
SELECT 
  'QUERY FRONTEND' AS info,
  o.id,
  o.status,
  o.total_amount,
  COUNT(oi.id) AS items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  AND o.status != 'draft'
GROUP BY o.id, o.status, o.total_amount
ORDER BY o.created_at DESC;
