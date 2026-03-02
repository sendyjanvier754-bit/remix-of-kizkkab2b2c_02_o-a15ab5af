-- =====================================================
-- VERIFICACIÓN DE MIGRACIÓN EXITOSA
-- =====================================================
-- Ejecuta esto para confirmar que los pedidos históricos
-- se agregaron correctamente al inventario B2C
-- =====================================================

-- 1. COMPARACIÓN ANTES/DESPUÉS
SELECT 
  '📊 ESTADO DEL INVENTARIO' as seccion,
  'ANTES de migración' as momento,
  6 as productos,
  3 as variantes,
  51 as stock_total
UNION ALL
SELECT 
  '📊 ESTADO DEL INVENTARIO',
  'DESPUÉS de migración',
  COUNT(DISTINCT sc.id),
  COUNT(scv.id),
  COALESCE(SUM(scv.stock), 0)
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id;

-- 2. PRODUCTOS POR DISPONIBILIDAD
SELECT 
  '📈 INVENTARIO POR ESTADO' as seccion,
  scv.availability_status,
  COUNT(*) as cantidad_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status
ORDER BY scv.availability_status;

-- 3. DETALLE DE PRODUCTOS MIGRADOS
SELECT 
  '📦 PRODUCTOS EN INVENTARIO B2C' as seccion,
  s.nombre as tienda,
  sc.nombre as producto,
  scv.sku,
  scv.stock,
  scv.availability_status,
  scv.created_at as fecha_agregado
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
ORDER BY scv.created_at DESC;

-- 4. VERIFICAR QUE LOS 4 PEDIDOS CON variant_id SE PROCESARON
SELECT 
  '🔍 PEDIDOS ORIGEN' as seccion,
  o.order_number,
  o.status,
  o.buyer_id,
  COUNT(oi.id) as items_en_pedido,
  SUM(oi.cantidad) as unidades_totales
FROM orders_b2b o
INNER JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE oi.variant_id IS NOT NULL
GROUP BY o.id, o.order_number, o.status, o.buyer_id
ORDER BY o.created_at;

-- 5. VISTA COMPLETA CON DISPONIBILIDAD
SELECT 
  '📊 VISTA SELLER_CATALOG_WITH_VARIANTS' as seccion,
  *
FROM v_seller_catalog_with_variants
ORDER BY created_at DESC;

SELECT '
✅ VERIFICACIÓN COMPLETADA

💡 INTERPRETACIÓN:
- Si "productos" y "variantes" aumentaron → Migración exitosa ✅
- Si "availability_status" muestra "pending" y "available" → Correcto ✅
- Si ves productos con fecha reciente (hoy) → Son los migrados ✅

🎯 SIGUIENTE PASO:
- Verificar en el frontend que los compradores vean su inventario B2C
- Si los números no cambiaron, revisar la sección "Messages" o "Logs" 
  del SQL Editor donde están los mensajes de progreso del DO $$ block

' as ayuda;
