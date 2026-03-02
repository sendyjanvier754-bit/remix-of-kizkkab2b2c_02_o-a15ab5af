-- Verificar la relación completa: Order → Product → Variant

SELECT 
  '📦 ESTRUCTURA DE PEDIDOS B2B' as info,
  o.id as order_id,
  o.buyer_id,
  o.status,
  oi.product_id,
  p.nombre as producto_nombre,
  oi.variant_id,
  pv.sku as variant_sku,
  pv.attribute_combination,
  oi.cantidad,
  CASE 
    WHEN pv.id IS NOT NULL THEN '✅ Variant existe'
    ELSE '❌ Variant NO existe'
  END as variant_valido
FROM orders_b2b o
JOIN order_items_b2b oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
LEFT JOIN product_variants pv ON pv.id = oi.variant_id
ORDER BY o.created_at DESC
LIMIT 10;
