-- ============================================================================
-- 🚨 DIAGNÓSTICO URGENTE: Por qué no se muestran pedidos en Mis Compras
-- ============================================================================
-- Usuario reporta que después del fix TODAVÍA no se muestran pedidos

-- ============================================================================
-- PASO 1: Verificar si HAY pedidos en la tabla
-- ============================================================================

SELECT 
  COUNT(*) AS total_pedidos_en_sistema,
  COUNT(CASE WHEN status != 'draft' THEN 1 END) AS pedidos_no_draft,
  COUNT(CASE WHEN buyer_id IS NOT NULL THEN 1 END) AS pedidos_con_buyer_id,
  COUNT(CASE WHEN buyer_id IS NULL THEN 1 END) AS pedidos_sin_buyer_id,
  MIN(created_at) AS pedido_mas_antiguo,
  MAX(created_at) AS pedido_mas_reciente
FROM orders_b2b
WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- PASO 2: Ver TODOS los pedidos recientes (sin filtros)
-- ============================================================================

SELECT 
  o.id,
  o.created_at,
  o.buyer_id,
  o.seller_id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.total_quantity,
  COUNT(oi.id) AS num_items,
  -- ¿Es el usuario actual?
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ SOY YO (BUYER)'
    WHEN o.seller_id = auth.uid() THEN '✅ SOY YO (SELLER)'
    ELSE '❌ NO SOY YO'
  END AS relacion_usuario,
  -- ¿Tiene items?
  CASE 
    WHEN COUNT(oi.id) = 0 THEN '❌ SIN ITEMS'
    ELSE '✅ CON ITEMS'
  END AS tiene_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.created_at, o.buyer_id, o.seller_id, o.status, 
         o.payment_status, o.total_amount, o.total_quantity
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 3: Verificar USER ID actual (quién soy yo)
-- ============================================================================

SELECT 
  auth.uid() AS mi_user_id,
  u.email AS mi_email,
  p.full_name AS mi_nombre,
  p.role AS mi_rol,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NO ESTOY LOGUEADO'
    ELSE '✅ LOGUEADO'
  END AS estado_sesion
FROM auth.users u
LEFT JOIN profiles p ON p.id = auth.uid()
WHERE u.id = auth.uid();

-- ============================================================================
-- PASO 4: Query EXACTA que usa "Mis Compras" (reproducir frontend)
-- ============================================================================

-- Esta es la query exacta de useBuyerB2BOrders
SELECT 
  o.*,
  COUNT(oi.id) AS item_count
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE 
  -- FILTRO PRINCIPAL (igual que frontend)
  (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  -- FILTRO ADICIONAL (igual que frontend)
  AND o.status != 'draft'
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 10;

-- Si esta query devuelve 0 filas, el problema es que:
-- A) No hay pedidos con mi user_id
-- B) Todos mis pedidos son 'draft'
-- C) RLS está bloqueando

-- ============================================================================
-- PASO 5: Verificar RLS Policies de orders_b2b
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY policyname;

-- ============================================================================
-- PASO 6: Probar query SIN RLS (como superuser) para comparar
-- ============================================================================

-- NOTA: Esta query solo funciona si eres admin/superuser
-- Te muestra TODOS los pedidos sin restricciones RLS

SELECT 
  o.id,
  o.buyer_id,
  o.seller_id,
  o.status,
  o.created_at,
  COUNT(oi.id) AS items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.buyer_id, o.seller_id, o.status, o.created_at
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- PASO 7: Verificar si orders_b2b tiene RLS habilitado
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'orders_b2b'
  AND schemaname = 'public';

-- Si rls_enabled = true pero no ves pedidos, el problema es RLS
-- Si rls_enabled = false y no ves pedidos, el problema es que no hay pedidos con tu ID

-- ============================================================================
-- PASO 8: Ver detalles de UN pedido específico (si existe)
-- ============================================================================

-- Reemplaza 'ORDER_ID_AQUI' con un ID real de PASO 2
-- SELECT 
--   o.*,
--   json_agg(oi.*) AS items
-- FROM orders_b2b o
-- LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
-- WHERE o.id = 'ORDER_ID_AQUI'
-- GROUP BY o.id;

-- ============================================================================
-- PASO 9: Verificar si hay pedidos creados HOY
-- ============================================================================

SELECT 
  o.id,
  o.created_at,
  o.buyer_id,
  o.status,
  o.total_amount,
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ MI PEDIDO'
    ELSE '❌ DE OTRO USUARIO'
  END AS es_mio
FROM orders_b2b o
WHERE DATE(o.created_at) = CURRENT_DATE
ORDER BY o.created_at DESC;

-- ============================================================================
-- PASO 10: Comparar con b2b_carts (tal vez se crearon carritos pero no orders)
-- ============================================================================

SELECT 
  c.id AS cart_id,
  c.buyer_user_id,
  c.status AS cart_status,
  c.created_at AS cart_fecha,
  COUNT(ci.id) AS cart_items,
  CASE 
    WHEN c.buyer_user_id = auth.uid() THEN '✅ MI CARRITO'
    ELSE '❌ DE OTRO'
  END AS es_mio,
  -- ¿Hay un order correspondiente?
  EXISTS(
    SELECT 1 FROM orders_b2b o 
    WHERE o.buyer_id = c.buyer_user_id 
    AND DATE(o.created_at) = DATE(c.created_at)
  ) AS tiene_order_correspondiente
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
WHERE c.created_at > NOW() - INTERVAL '7 days'
GROUP BY c.id, c.buyer_user_id, c.status, c.created_at
ORDER BY c.created_at DESC
LIMIT 20;

-- ============================================================================
-- 📋 INSTRUCCIONES DE EJECUCIÓN
-- ============================================================================

/*
EJECUTA EN ESTE ORDEN:

1. PASO 3 PRIMERO - Para confirmar tu user_id
   → Anota el "mi_user_id" que sale

2. PASO 1 - Para ver si HAY pedidos en el sistema
   → Si total_pedidos_en_sistema = 0, no hay ningún pedido
   → Si pedidos_sin_buyer_id > 0, algunos pedidos no tienen buyer_id

3. PASO 2 - Ver todos los pedidos recientes
   → Busca en "relacion_usuario" cuántos dicen "SOY YO"
   → Si todos dicen "NO SOY YO", significa que los pedidos están asignados a otro user_id

4. PASO 4 - La query exacta del frontend
   → Si devuelve 0 filas pero PASO 2 mostró pedidos, el problema es el filtro
   → Si devuelve filas, entonces el problema es del frontend, no de la DB

5. PASO 5 - Verificar RLS policies
   → Debe haber una política "orders_b2b_select_seller" o similar
   → Debe permitir: seller_id = auth.uid() OR buyer_id = auth.uid()

============================================================================
🎯 INTERPRETACIÓN DE RESULTADOS
============================================================================

ESCENARIO A: PASO 1 muestra 0 pedidos
  → NO HAY PEDIDOS en el sistema
  → Solución: Crear un pedido de prueba

ESCENARIO B: PASO 2 muestra pedidos pero todos "NO SOY YO"
  → Los pedidos existen pero con OTRO user_id
  → Solución: Ejecutar script de transferencia de pedidos
  → O verificar si estás logueado con cuenta diferente

ESCENARIO C: PASO 2 muestra "SOY YO" pero PASO 4 devuelve 0 filas
  → RLS está bloqueando
  → Solución: Ejecutar FIX_ORDERS_RLS_COMPLETE.sql

ESCENARIO D: PASO 4 devuelve filas pero frontend no muestra
  → Problema en el frontend (cache, React Query, etc.)
  → Solución: Limpiar cache del navegador y recargar

ESCENARIO E: PASO 2 muestra "SOY YO" pero "SIN ITEMS"
  → Pedidos sin items (bug que acabamos de corregir)
  → Solución: Los pedidos anteriores al fix no tienen items
  → Crear nuevo pedido para probar

============================================================================
*/
