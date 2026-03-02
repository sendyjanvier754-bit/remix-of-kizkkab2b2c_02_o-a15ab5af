-- =====================================================
-- VERIFICACIÓN COMPLETA DE ESTRUCTURAS PARA MIGRACIÓN
-- =====================================================

-- 1. Verificar columnas de orders_b2b
SELECT 
  '📋 COLUMNAS DE ORDERS_B2B' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
ORDER BY ordinal_position;

-- 2. Verificar columnas de order_items_b2b
SELECT 
  '📦 COLUMNAS DE ORDER_ITEMS_B2B' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;

-- 3. Verificar columnas de seller_catalog
SELECT 
  '🏪 COLUMNAS DE SELLER_CATALOG' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog'
ORDER BY ordinal_position;

-- 4. Verificar columnas de seller_catalog_variants
SELECT 
  '📊 COLUMNAS DE SELLER_CATALOG_VARIANTS' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog_variants'
ORDER BY ordinal_position;

-- 5. Verificar columnas de stores
SELECT 
  '🏬 COLUMNAS DE STORES' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- 6. Ver muestra de un pedido
SELECT 
  '🔍 MUESTRA DE PEDIDO' as seccion,
  *
FROM orders_b2b
LIMIT 1;

-- 7. Ver estados disponibles en orders_b2b
SELECT 
  '📊 ESTADOS DE PEDIDOS' as seccion,
  status,
  COUNT(*) as total
FROM orders_b2b
GROUP BY status
ORDER BY total DESC;

-- 8. Ver pedidos con variant_id válido
SELECT 
  '✅ PEDIDOS CON VARIANT_ID VÁLIDO' as seccion,
  o.status,
  COUNT(DISTINCT o.id) as total_pedidos,
  COUNT(oi.id) as total_items
FROM orders_b2b o
INNER JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE oi.variant_id IS NOT NULL
GROUP BY o.status
ORDER BY total_pedidos DESC;

-- 9. Ver inventario actual
SELECT 
  '📦 INVENTARIO ACTUAL' as seccion,
  COUNT(DISTINCT sc.id) as productos,
  COUNT(scv.id) as variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id;

-- 10. Ver availability_status existentes
SELECT 
  '🎯 AVAILABILITY_STATUS ACTUAL' as seccion,
  availability_status,
  COUNT(*) as cantidad
FROM seller_catalog_variants
WHERE availability_status IS NOT NULL
GROUP BY availability_status;

SELECT '
✅ VERIFICACIÓN COMPLETADA

Revisa los resultados para confirmar:
1. ✅ Qué columnas existen en orders_b2b
2. ✅ Si variant_id existe en order_items_b2b
3. ✅ Si availability_status existe en seller_catalog_variants
4. ✅ Cuántos pedidos hay para migrar
5. ✅ Estado actual del inventario

Con esta información crearemos el script de migración correcto.
' as resultado;
