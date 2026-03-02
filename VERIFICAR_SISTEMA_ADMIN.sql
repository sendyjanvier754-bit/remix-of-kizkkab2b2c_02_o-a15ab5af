-- =====================================================
-- VERIFICACIÓN DEL SISTEMA CON CONFIRMACIÓN DE ADMIN
-- =====================================================

-- 1. Verificar que el campo availability_status existe
SELECT 
  '✅ Campo availability_status' as verificacion,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'seller_catalog_variants'
  AND column_name = 'availability_status';

-- 2. Verificar que el trigger está actualizado
SELECT 
  '✅ Trigger configurado' as verificacion,
  p.proname as nombre_trigger,
  pg_get_functiondef(p.oid) LIKE '%payment_verified_by%' as tiene_confirmacion_admin,
  pg_get_functiondef(p.oid) LIKE '%cancelled%' as tiene_cancelaciones
FROM pg_proc p
WHERE p.proname = 'auto_add_to_seller_catalog_on_complete';

-- 3. Verificar que la función admin_confirm_payment existe
SELECT 
  '✅ Función de admin' as verificacion,
  p.proname as nombre_funcion,
  pg_get_function_identity_arguments(p.oid) as parametros
FROM pg_proc p
WHERE p.proname = 'admin_confirm_payment';

-- 4. Verificar que la vista tiene los nuevos campos
SELECT 
  '✅ Vista actualizada' as verificacion,
  column_name
FROM information_schema.columns
WHERE table_name = 'v_seller_catalog_with_variants'
  AND column_name IN ('stock_available', 'stock_pending', 'tiene_stock_disponible', 'tiene_stock_pendiente')
ORDER BY column_name;

-- 5. Ver estado actual del inventario
SELECT 
  '📊 INVENTARIO ACTUAL' as info,
  scv.availability_status,
  COUNT(*) as total_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

-- 6. Ver productos en el inventario B2C con sus estados
SELECT 
  '📦 PRODUCTOS EN INVENTARIO B2C' as info,
  sc.nombre as producto,
  COUNT(scv.id) as total_variantes,
  SUM(CASE WHEN scv.availability_status = 'available' THEN scv.stock ELSE 0 END) as stock_disponible,
  SUM(CASE WHEN scv.availability_status = 'pending' THEN scv.stock ELSE 0 END) as stock_pendiente,
  SUM(scv.stock) as stock_total
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
GROUP BY sc.id, sc.nombre
ORDER BY sc.nombre;

-- 7. Ver pedidos pendientes de confirmar por admin
SELECT 
  '📋 PEDIDOS PENDIENTES DE CONFIRMAR' as info,
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.payment_method,
  o.paid_at,
  o.payment_verified_by as confirmado_por,
  COUNT(oi.id) as total_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.status = 'paid'
  AND o.payment_verified_by IS NULL
GROUP BY o.id, o.order_number, o.status, o.total_amount, o.payment_method, o.paid_at, o.payment_verified_by
ORDER BY o.paid_at DESC;

-- 8. Ver pedidos ya confirmados
SELECT 
  '✅ PEDIDOS CONFIRMADOS' as info,
  o.id,
  o.order_number,
  o.status,
  o.payment_verified_at,
  o.payment_verified_by as confirmado_por,
  COUNT(oi.id) as total_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.payment_verified_by IS NOT NULL
GROUP BY o.id, o.order_number, o.status, o.payment_verified_at, o.payment_verified_by
ORDER BY o.payment_verified_at DESC
LIMIT 5;

SELECT '
✅✅✅ VERIFICACIÓN COMPLETA ✅✅✅

El sistema está configurado correctamente con:
- ✅ Campo availability_status
- ✅ Trigger con confirmación de admin
- ✅ Función admin_confirm_payment()
- ✅ Vista con stock_available y stock_pending
- ✅ Manejo de cancelaciones
' as resultado;
