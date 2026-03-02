-- =====================================================
-- VERIFICACIÓN: Funciones Inventario B2C
-- =====================================================
-- Ejecuta esto para verificar que todo funciona correctamente
-- =====================================================

-- 1. Verificar que las funciones existen
SELECT 
  '✅ FUNCIONES ENCONTRADAS' as status,
  p.proname as nombre_funcion,
  pg_get_function_arguments(p.oid) as parametros,
  pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' as es_segura
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_inventario_b2c', 'get_inventario_b2c_resumen')
ORDER BY p.proname;

-- 2. Verificar que el tipo existe
SELECT 
  '✅ TIPO ENCONTRADO' as status,
  t.typname as nombre_tipo,
  a.attname as campo,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as tipo_dato
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_attribute a ON a.attrelid = t.typrelid
WHERE n.nspname = 'public'
  AND t.typname = 'inventario_b2c_item'
ORDER BY a.attnum;

-- 3. Verificar permisos
SELECT 
  '✅ PERMISOS' as status,
  p.proname as funcion,
  array_agg(DISTINCT pr.rolname) as roles_con_permiso
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_proc_acl pa ON pa.p_oid = p.oid
LEFT JOIN pg_roles pr ON pr.oid = ANY(pa.grantee)
WHERE n.nspname = 'public'
  AND p.proname IN ('get_inventario_b2c', 'get_inventario_b2c_resumen')
GROUP BY p.proname;

-- 4. Verificar estructura de orders_b2b
SELECT 
  '📊 ESTRUCTURA orders_b2b' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
  AND column_name IN ('id', 'buyer_id', 'status', 'payment_status', 'order_number', 'created_at')
ORDER BY ordinal_position;

-- 5. Verificar estructura de order_items_b2b
SELECT 
  '📊 ESTRUCTURA order_items_b2b' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
  AND column_name IN ('id', 'order_id', 'product_id', 'variant_id', 'cantidad', 'sku')
ORDER BY ordinal_position;

-- 6. Contar pedidos elegibles para inventario B2C
SELECT 
  '📦 PEDIDOS ELEGIBLES' as info,
  COUNT(DISTINCT o.id) as total_pedidos,
  COUNT(DISTINCT oi.product_id) as productos_unicos,
  COUNT(DISTINCT oi.variant_id) as variantes_unicas,
  SUM(oi.cantidad) as unidades_totales
FROM orders_b2b o
INNER JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.status IN ('paid', 'placed', 'delivered', 'completed')
  AND o.status != 'cancelled'
  AND oi.variant_id IS NOT NULL;

-- 7. Distribución por estado de pedidos
SELECT 
  '📊 DISTRIBUCIÓN POR ESTADO' as info,
  o.status,
  COUNT(DISTINCT o.id) as cantidad_pedidos,
  SUM(oi.cantidad) as unidades_totales
FROM orders_b2b o
INNER JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE oi.variant_id IS NOT NULL
GROUP BY o.status
ORDER BY cantidad_pedidos DESC;

-- 8. Prueba de ejecución (sin auth.uid() - esperará estar vacío o error)
SELECT 
  '🧪 PRUEBA DE EJECUCIÓN' as test,
  'Esta query no retornará datos porque no hay auth.uid() en SQL Editor' as nota;

-- Si quieres probar con un user_id específico (solo para testing):
/*
-- Primero encuentra un user_id válido de stores:
SELECT id as store_id, owner_user_id, nombre 
FROM stores 
WHERE owner_user_id IS NOT NULL
LIMIT 5;

-- Luego prueba con ese user_id:
SELECT * FROM get_inventario_b2c(
  p_user_id := 'PEGA-AQUI-UN-UUID-VALIDO',
  p_availability_status := NULL,
  p_limit := 10
);
*/

SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERIFICACIÓN COMPLETADA

📋 RESUMEN:
- Si ves "✅ FUNCIONES ENCONTRADAS" con 2 funciones → Todo bien
- Si ves "✅ TIPO ENCONTRADO" con campos → Tipo creado correctamente  
- Si ves datos en "PEDIDOS ELEGIBLES" → Hay pedidos para mostrar
- La prueba de ejecución solo funciona desde el frontend con auth.uid()

🎯 SIGUIENTE PASO:
1. Ir al frontend: http://localhost:5173/seller/inventario-b2c
2. Iniciar sesión con un usuario que tenga pedidos B2B pagados
3. Deberías ver tus productos en el inventario

🔧 SI NO FUNCIONA:
- Verifica que tu usuario tenga pedidos con status = paid/delivered/completed
- Verifica que order_items_b2b.variant_id IS NOT NULL
- Verifica que tengas una tienda (stores.owner_user_id = tu user_id)

' as resultado;
