-- Investigar productos sin variantes en seller_catalog

-- 1. Ver productos en seller_catalog sin variantes
SELECT 
  '❌ PRODUCTOS SIN VARIANTES' as info,
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.nombre,
  sc.is_active,
  s.name as store_name,
  s.owner_user_id
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
WHERE sc.source_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  )
ORDER BY sc.nombre;

-- 2. Ver si esos usuarios tienen pedidos completados
SELECT 
  '🔍 PEDIDOS DE ESOS USUARIOS' as info,
  o.id as order_id,
  o.buyer_id,
  o.status,
  s.name as store_name,
  COUNT(oi.id) as total_items
FROM orders_b2b o
JOIN stores s ON s.owner_user_id = o.buyer_id
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.buyer_id IN (
  SELECT DISTINCT s.owner_user_id
  FROM seller_catalog sc
  JOIN stores s ON s.id = sc.seller_store_id
  WHERE sc.source_product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM seller_catalog_variants scv 
      WHERE scv.seller_catalog_id = sc.id
    )
)
GROUP BY o.id, o.buyer_id, o.status, s.name
ORDER BY o.status, o.created_at DESC;

-- 3. Ver items de esos pedidos con variant_id
SELECT 
  '📦 ITEMS CON VARIANT_ID' as info,
  o.id as order_id,
  o.status,
  oi.product_id,
  p.nombre as producto,
  oi.variant_id,
  oi.cantidad,
  CASE WHEN oi.variant_id IS NOT NULL THEN '✅ Tiene variant_id' ELSE '❌ Sin variant_id' END as estado
FROM orders_b2b o
JOIN order_items_b2b oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.buyer_id IN (
  SELECT DISTINCT s.owner_user_id
  FROM seller_catalog sc
  JOIN stores s ON s.id = sc.seller_store_id
  WHERE sc.source_product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM seller_catalog_variants scv 
      WHERE scv.seller_catalog_id = sc.id
    )
)
ORDER BY o.status, p.nombre;
