-- =====================================================
-- VISTA SIMPLE: INVENTARIO B2C (Pedidos Pagados)
-- =====================================================
-- Muestra todos los productos que los compradores pueden
-- revender, incluyendo pedidos históricos pagados
-- =====================================================

CREATE OR REPLACE VIEW v_inventario_b2c_completo AS
SELECT 
  s.id as seller_store_id,
  s.nombre as tienda_vendedor,
  s.owner_user_id as vendedor_user_id,
  
  -- Info del producto
  p.id as product_id,
  p.nombre as producto_nombre,
  p.descripcion_corta,
  p.imagen_principal,
  p.galeria_imagenes,
  
  -- Info de la variante
  pv.id as variant_id,
  pv.sku,
  pv.color,
  pv.size,
  pv.precio_original,
  
  -- Stock/cantidad del pedido
  oi.cantidad as stock,
  
  -- Estado del pedido
  o.status as order_status,
  o.payment_status,
  o.order_number,
  o.payment_confirmed_at,
  
  -- Disponibilidad
  CASE 
    WHEN o.status = 'cancelled' THEN 'cancelled'
    WHEN o.status IN ('paid', 'placed') THEN 'pending'
    WHEN o.status IN ('delivered', 'completed') THEN 'available'
    ELSE 'pending'
  END as availability_status,
  
  -- Fechas
  o.created_at as fecha_pedido,
  o.updated_at as ultima_actualizacion

FROM order_items_b2b oi
INNER JOIN orders_b2b o ON o.id = oi.order_id
INNER JOIN products p ON p.id = oi.product_id
LEFT JOIN product_variants pv ON pv.id = oi.variant_id
INNER JOIN stores s ON s.owner_user_id = o.buyer_id

WHERE 
  -- Solo pedidos pagados o completados
  o.status IN ('paid', 'placed', 'delivered', 'completed')
  -- Y que no estén cancelados
  AND o.status != 'cancelled'
  -- Y que tengan variant_id válido
  AND oi.variant_id IS NOT NULL

ORDER BY o.payment_confirmed_at DESC NULLS LAST;

-- ⚠️ IMPORTANTE: No se puede aplicar RLS directamente a vistas
-- La seguridad se hereda de las tablas base (orders_b2b, order_items_b2b, etc.)
-- Ver archivo SEGURIDAD_INVENTARIO_B2C.sql para configurar RLS correctamente

COMMENT ON VIEW v_inventario_b2c_completo IS 
'Vista de inventario B2C que muestra pedidos pagados. 
SEGURIDAD: Heredada de tablas base con RLS. 
Cada usuario solo ve sus propios pedidos a través de orders_b2b.buyer_id';

-- Query de prueba
SELECT 
  tienda_vendedor,
  producto_nombre,
  sku,
  color,
  size,
  stock,
  availability_status,
  order_status,
  order_number,
  fecha_pedido
FROM v_inventario_b2c_completo
ORDER BY fecha_pedido DESC;

SELECT '
✅ VISTA CREADA: v_inventario_b2c_completo

📋 QUÉ HACE:
- Muestra todos los productos de pedidos pagados/completados
- Incluye pedidos históricos Y nuevos pedidos
- Cada comprador ve sus propios productos para revender
- No duplica datos, solo lee de orders_b2b directamente

🎯 USO EN FRONTEND:
SELECT * FROM v_inventario_b2c_completo
WHERE vendedor_user_id = [current_user_id]

💡 VENTAJAS:
- No necesita migración de datos
- Datos siempre actualizados desde orders_b2b
- Más simple de mantener
- Un solo query muestra todo el inventario B2C

' as resultado;
