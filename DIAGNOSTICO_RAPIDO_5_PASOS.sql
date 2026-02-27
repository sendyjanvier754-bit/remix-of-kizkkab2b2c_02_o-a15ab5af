-- ============================================================================
-- 🚨 DIAGNÓSTICO RÁPIDO - Ejecuta esto en Supabase SQL Editor
-- ============================================================================

-- COPIA Y PEGA TODO ESTE BLOQUE EN SUPABASE SQL EDITOR Y EJECUTA

-- ============================================================================
-- 1️⃣ ¿QUIÉN SOY YO?
-- ============================================================================
SELECT 
  '1️⃣ MI IDENTIDAD' AS paso,
  auth.uid() AS mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS mi_email;

-- ============================================================================
-- 2️⃣ ¿HAY PEDIDOS EN EL SISTEMA?
-- ============================================================================
SELECT 
  '2️⃣ PEDIDOS EN SISTEMA' AS paso,
  COUNT(*) AS total_pedidos,
  COUNT(CASE WHEN buyer_id IS NOT NULL THEN 1 END) AS con_buyer_id,
  COUNT(CASE WHEN buyer_id IS NULL THEN 1 END) AS sin_buyer_id,
  COUNT(CASE WHEN status != 'draft' THEN 1 END) AS no_draft
FROM orders_b2b
WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- 3️⃣ PEDIDOS RECIENTES - ¿SON MÍOS?
-- ============================================================================
SELECT 
  '3️⃣ PEDIDOS RECIENTES' AS paso,
  o.id,
  o.created_at,
  o.buyer_id,
  o.status,
  o.total_amount,
  COUNT(oi.id) AS items,
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ SOY BUYER'
    WHEN o.seller_id = auth.uid() THEN '✅ SOY SELLER'
    ELSE '❌ NO SOY YO'
  END AS relacion
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.created_at, o.buyer_id, o.seller_id, o.status, o.total_amount
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4️⃣ QUERY EXACTA DEL FRONTEND (como "Mis Compras")
-- ============================================================================
SELECT 
  '4️⃣ QUERY FRONTEND' AS paso,
  o.id,
  o.status,
  o.total_amount,
  o.created_at
FROM orders_b2b o
WHERE (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  AND o.status != 'draft'
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 5️⃣ VERIFICAR RLS POLICIES
-- ============================================================================
SELECT 
  '5️⃣ RLS POLICIES' AS paso,
  policyname,
  cmd,
  SUBSTRING(qual::text, 1, 100) AS filtro
FROM pg_policies
WHERE tablename = 'orders_b2b';

-- ============================================================================
-- 📊 INTERPRETACIÓN DE RESULTADOS
-- ============================================================================

/*
CÓMO INTERPRETAR:

1️⃣ MI IDENTIDAD:
   - Anota tu "mi_user_id" - lo necesitarás

2️⃣ PEDIDOS EN SISTEMA:
   - Si total_pedidos = 0 → NO HAY PEDIDOS, crea uno de prueba
   - Si sin_buyer_id > 0 → Hay pedidos sin buyer_id asignado
   - Si no_draft = 0 → Todos son drafts, no se mostrarán

3️⃣ PEDIDOS RECIENTES:
   - Busca cuántos tienen "✅ SOY BUYER" o "✅ SOY SELLER"
   - Si todos son "❌ NO SOY YO" → Los pedidos están asignados a otro usuario
   - Si ves "items = 0" → Pedidos sin items (bug anterior)

4️⃣ QUERY FRONTEND:
   - Esta es la query EXACTA que usa "Mis Compras"
   - Si devuelve 0 filas pero 3️⃣ mostró pedidos "SOY YO":
     → Problema: Los pedidos son status='draft'
   - Si devuelve filas:
     → Problema está en el frontend (cache, React Query)

5️⃣ RLS POLICIES:
   - Debe existir política "orders_b2b_select_seller" o similar
   - El filtro debe incluir: buyer_id = auth.uid() OR seller_id = auth.uid()

============================================================================
🎯 SOLUCIONES SEGÚN RESULTADO
============================================================================

CASO A: 2️⃣ muestra total_pedidos = 0
  → NO HAY PEDIDOS en absoluto
  → SOLUCIÓN: Crear pedido de prueba

CASO B: 3️⃣ todos son "❌ NO SOY YO"
  → Pedidos de otro usuario (cuenta diferente)
  → SOLUCIÓN: Ejecutar TRANSFERIR_PEDIDOS_OTRA_CUENTA.sql
  → O verificar que estás logueado con la cuenta correcta

CASO C: 3️⃣ muestra "✅ SOY YO" pero 4️⃣ devuelve 0
  → Todos tus pedidos son status='draft'
  → SOLUCIÓN: Cambiar status a 'placed' manualmente:
    UPDATE orders_b2b 
    SET status = 'placed' 
    WHERE buyer_id = auth.uid() AND status = 'draft';

CASO D: 3️⃣ muestra "items = 0"
  → Pedidos sin items (bug que corregimos)
  → SOLUCIÓN: Crear nuevo pedido después del fix

CASO E: 4️⃣ devuelve filas pero frontend no muestra
  → Cache del navegador o React Query
  → SOLUCIÓN:
    1. Ctrl+Shift+R (recarga dura)
    2. Limpiar cache del navegador
    3. Abrir en ventana incógnito

CASO F: 5️⃣ no muestra políticas RLS
  → RLS no configurado correctamente
  → SOLUCIÓN: Ejecutar FIX_ORDERS_RLS_COMPLETE.sql

============================================================================
*/
