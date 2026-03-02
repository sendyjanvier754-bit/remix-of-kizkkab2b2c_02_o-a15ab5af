-- =====================================================
-- GUÍA COMPLETA DE USO DEL SISTEMA
-- =====================================================
-- Esta guía muestra cómo funciona el flujo completo
-- =====================================================

-- ============================================
-- ESCENARIO DE EJEMPLO
-- ============================================
-- 1. Usuario "María" (compradora/seller) compra productos en B2B
-- 2. Paga el pedido → status='paid' pero NO aparece en su inventario B2C aún
-- 3. Admin "Juan" revisa y confirma el pago
-- 4. Productos APARECEN en el inventario B2C de María con status "Disponible pronto"
-- 5. Pedido se entrega → Status cambia a "Disponible"
-- 6. María vende los productos en B2C a sus clientes finales

-- ============================================
-- PARA ADMINS: Ver pedidos pendientes
-- ============================================
SELECT 
  o.id as order_id,
  o.order_number,
  o.status,
  o.total_amount,
  o.currency,
  o.payment_method,
  o.payment_reference,
  o.paid_at,
  u.email as comprador_email,
  s.name as tienda_comprador,
  COUNT(oi.id) as total_items,
  STRING_AGG(p.nombre, ', ') as productos
FROM orders_b2b o
LEFT JOIN auth.users u ON u.id = o.buyer_id
LEFT JOIN stores s ON s.owner_user_id = o.buyer_id
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
LEFT JOIN products p ON p.id = oi.product_id
WHERE o.status = 'paid'
  AND o.payment_verified_by IS NULL
GROUP BY o.id, o.order_number, o.status, o.total_amount, o.currency,
         o.payment_method, o.payment_reference, o.paid_at, u.email, s.name
ORDER BY o.paid_at DESC;

-- ============================================
-- PARA ADMINS: Confirmar un pago
-- ============================================
-- Opción 1: Confirmar manualmente
-- UPDATE orders_b2b 
-- SET 
--   payment_verified_by = 'admin-user-id-aquí',
--   payment_verified_at = now(),
--   confirmed_at = now(),
--   internal_notes = 'Pago verificado mediante transferencia bancaria'
-- WHERE id = 'order-id-aquí';

-- Opción 2: Usar la función (RECOMENDADO)
-- SELECT admin_confirm_payment(
--   p_order_id := 'order-id-aquí',
--   p_admin_user_id := auth.uid(),  -- O el UUID del admin
--   p_notes := 'Pago verificado mediante transferencia bancaria'
-- );

-- Ejemplo con resultado:
-- {
--   "success": true,
--   "message": "Pago confirmado. Los productos se agregarán al inventario B2C del comprador.",
--   "order_id": "uuid...",
--   "order_number": "ORD-12345",
--   "confirmed_by": "admin-uuid",
--   "confirmed_at": "2026-02-28T..."
-- }

-- ============================================
-- PARA COMPRADORES: Ver su inventario B2C
-- ============================================
-- Ver todos los productos en el inventario del comprador
SELECT 
  v.catalog_id,
  v.nombre as producto,
  v.total_variantes,
  v.stock_available as stock_disponible,
  v.stock_pending as stock_pendiente,
  v.total_stock,
  v.precio_min,
  v.precio_max,
  v.tiene_stock_disponible,
  v.tiene_stock_pendiente,
  v.variantes
FROM v_seller_catalog_with_variants v
WHERE v.seller_store_id = 'store-id-del-comprador'
  AND v.is_active = true
ORDER BY v.catalog_created_at DESC;

-- ============================================
-- VER DETALLES DE UN PRODUCTO CON SUS VARIANTES
-- ============================================
SELECT 
  sc.nombre as producto,
  scv.id as variant_id,
  scv.sku,
  scv.stock,
  scv.availability_status,
  CASE scv.availability_status
    WHEN 'pending' THEN '⏳ Disponible pronto'
    WHEN 'available' THEN '✅ En stock'
    WHEN 'out_of_stock' THEN '❌ Agotado'
  END as estado_visual,
  scv.is_available,
  pv.attribute_combination as atributos,
  pv.price as precio
FROM seller_catalog sc
JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
JOIN product_variants pv ON pv.id = scv.variant_id
WHERE sc.seller_store_id = 'store-id-del-comprador'
ORDER BY sc.nombre, scv.sku;

-- ============================================
-- FLUJO DE CANCELACIÓN
-- ============================================
-- Si un pedido se cancela, el stock se resta automáticamente
-- UPDATE orders_b2b 
-- SET 
--   status = 'cancelled',
--   cancelled_at = now(),
--   notes = 'Cancelado por solicitud del cliente'
-- WHERE id = 'order-id-aquí';

-- El trigger detectará el cambio y:
-- 1. Restará las cantidades del inventario del comprador
-- 2. Si el stock llega a 0, eliminará la variante
-- 3. Si el producto se queda sin variantes, eliminará el producto

-- ============================================
-- FLUJO DE ENTREGA
-- ============================================
-- Cuando el pedido se entrega
-- UPDATE orders_b2b 
-- SET 
--   status = 'delivered',
--   delivered_at = now()
-- WHERE id = 'order-id-aquí';

-- El trigger actualizará:
-- availability_status: 'pending' → 'available'
-- El frontend mostrará: "⏳ Disponible pronto" → "✅ En stock"

-- ============================================
-- QUERIES ÚTILES PARA MONITOREO
-- ============================================

-- 1. Resumen de inventario por seller
SELECT 
  s.name as tienda,
  COUNT(DISTINCT sc.id) as total_productos,
  COUNT(scv.id) as total_variantes,
  SUM(CASE WHEN scv.availability_status = 'available' THEN scv.stock ELSE 0 END) as stock_disponible,
  SUM(CASE WHEN scv.availability_status = 'pending' THEN scv.stock ELSE 0 END) as stock_pendiente,
  SUM(scv.stock) as stock_total
FROM stores s
LEFT JOIN seller_catalog sc ON sc.seller_store_id = s.id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
GROUP BY s.id, s.name
ORDER BY stock_total DESC;

-- 2. Historial de pedidos de un comprador
SELECT 
  o.order_number,
  o.status,
  o.total_amount,
  o.paid_at,
  o.payment_verified_at,
  o.delivered_at,
  o.cancelled_at,
  CASE 
    WHEN o.status = 'paid' AND o.payment_verified_by IS NULL THEN '⏳ Esperando confirmación de admin'
    WHEN o.status = 'paid' AND o.payment_verified_by IS NOT NULL THEN '✅ Confirmado - Agregado a inventario'
    WHEN o.status = 'delivered' THEN '✅ Entregado - Stock disponible'
    WHEN o.status = 'cancelled' THEN '❌ Cancelado - Stock restado'
    ELSE o.status
  END as estado_visual
FROM orders_b2b o
WHERE o.buyer_id = 'buyer-id-aquí'
ORDER BY o.created_at DESC;

-- 3. Productos más vendidos (agregados a inventarios)
SELECT 
  p.nombre as producto,
  COUNT(DISTINCT scv.seller_catalog_id) as vendedores_que_tienen,
  SUM(scv.stock) as stock_total_mercado,
  AVG(pv.price) as precio_promedio,
  MIN(pv.price) as precio_minimo,
  MAX(pv.price) as precio_maximo
FROM products p
JOIN product_variants pv ON pv.product_id = p.id
JOIN seller_catalog_variants scv ON scv.variant_id = pv.id
WHERE scv.is_available = true
GROUP BY p.id, p.nombre
ORDER BY stock_total_mercado DESC
LIMIT 10;

SELECT '
📚 GUÍA DE USO COMPLETA

🔐 PARA ADMINS:
1. Ver pedidos pendientes: Usar query de la línea 25
2. Confirmar pago: admin_confirm_payment()
3. Ver confirmados: Usar query de verificación

👤 PARA COMPRADORES (SELLERS):
1. Ver inventario B2C: v_seller_catalog_with_variants
2. Productos muestran:
   - ⏳ "Disponible pronto" (pedido pagado confirmado)
   - ✅ "En stock" (pedido entregado)
3. Frontend usa: stock_available, stock_pending, tiene_stock_disponible, tiene_stock_pendiente

🚀 FLUJOS AUTOMÁTICOS:
✅ Pedido pagado + admin confirma → Inventario B2C (pending)
✅ Pedido entregado → Status cambia a available
❌ Pedido cancelado → Stock se resta automáticamente

' as guia;
