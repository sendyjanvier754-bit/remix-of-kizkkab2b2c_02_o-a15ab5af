-- Verificar que order_items_b2b tiene variant_id

SELECT 
  '📦 ITEMS DE PEDIDOS B2B' as info,
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.variant_id,
  oi.sku,
  oi.cantidad,
  p.nombre as producto_nombre,
  o.status as pedido_status
FROM order_items_b2b oi
JOIN products p ON p.id = oi.product_id
JOIN orders_b2b o ON o.id = oi.order_id
ORDER BY o.created_at DESC
LIMIT 10;
