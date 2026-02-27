-- ============================================================================
-- INVESTIGAR PEDIDOS "PERDIDOS" - Por qué no se asignan correctamente
-- ============================================================================

-- ============================================================================
-- 1. VER TU USUARIO ACTUAL
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id_actual,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email_actual,
  (SELECT full_name FROM public.profiles WHERE id = auth.uid()) as mi_nombre_actual;

-- ============================================================================
-- 2. VER TODOS LOS PEDIDOS (incluso sin buyer_id/seller_id)
-- ============================================================================

SELECT 
  id,
  seller_id,
  buyer_id,
  order_number,
  status,
  payment_status,
  total_amount,
  created_at,
  CASE 
    WHEN seller_id IS NULL AND buyer_id IS NULL THEN '❌ HUÉRFANO (sin seller ni buyer)'
    WHEN seller_id IS NULL THEN '⚠️ Sin seller_id'
    WHEN buyer_id IS NULL THEN '⚠️ Sin buyer_id'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN '✅ MIO'
    ELSE '❓ De otro usuario'
  END as estado_asignacion
FROM public.orders_b2b
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 3. CONTAR PEDIDOS POR TIPO DE ASIGNACIÓN
-- ============================================================================

SELECT 
  CASE 
    WHEN seller_id IS NULL AND buyer_id IS NULL THEN 'Huérfanos (sin IDs)'
    WHEN seller_id IS NULL THEN 'Sin seller_id'
    WHEN buyer_id IS NULL THEN 'Sin buyer_id'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'Mis pedidos'
    ELSE 'De otros usuarios'
  END as tipo_pedido,
  COUNT(*) as cantidad,
  SUM(total_amount) as total_monto
FROM public.orders_b2b
GROUP BY 
  CASE 
    WHEN seller_id IS NULL AND buyer_id IS NULL THEN 'Huérfanos (sin IDs)'
    WHEN seller_id IS NULL THEN 'Sin seller_id'
    WHEN buyer_id IS NULL THEN 'Sin buyer_id'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'Mis pedidos'
    ELSE 'De otros usuarios'
  END
ORDER BY cantidad DESC;

-- ============================================================================
-- 4. VER DETALLES DE PEDIDOS HUÉRFANOS (sin buyer_id ni seller_id)
-- ============================================================================

SELECT 
  id,
  order_number,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  metadata,
  created_at,
  updated_at
FROM public.orders_b2b
WHERE seller_id IS NULL OR buyer_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 5. VERIFICAR SI HAY CARRITOS B2B ACTIVOS
-- ============================================================================

SELECT 
  id,
  user_id,
  status,
  source_order_id,
  created_at,
  updated_at
FROM public.b2b_carts
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 6. VER ITEMS DE CARRITO RELACIONADOS CON PEDIDOS
-- ============================================================================

SELECT 
  ci.id as cart_item_id,
  ci.cart_id,
  bc.user_id as cart_user_id,
  bc.source_order_id,
  o.seller_id as order_seller_id,
  o.buyer_id as order_buyer_id,
  ci.nombre as producto,
  ci.cantidad
FROM public.b2c_cart_items ci
JOIN public.b2b_carts bc ON ci.cart_id = bc.id
LEFT JOIN public.orders_b2b o ON bc.source_order_id = o.id
WHERE bc.user_id = auth.uid()
ORDER BY ci.created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. SOLUCIÓN: ASIGNAR PEDIDOS HUÉRFANOS AL USUARIO ACTUAL
-- ============================================================================
-- ESTO ASIGNARÁ LOS PEDIDOS SIN DUEÑO A TU USUARIO

-- Primero, ver cuántos pedidos se van a asignar:
SELECT 
  COUNT(*) as pedidos_a_asignar,
  SUM(total_amount) as total_valor
FROM public.orders_b2b
WHERE (seller_id IS NULL OR buyer_id IS NULL)
AND created_at > NOW() - INTERVAL '30 days';  -- Solo los últimos 30 días

-- EJECUTA ESTO SOLO SI ESTÁS SEGURO:
-- Asignar pedidos huérfanos de los últimos 30 días al usuario actual
/*
UPDATE public.orders_b2b
SET 
  seller_id = COALESCE(seller_id, auth.uid()),
  buyer_id = COALESCE(buyer_id, auth.uid()),
  updated_at = NOW()
WHERE (seller_id IS NULL OR buyer_id IS NULL)
AND created_at > NOW() - INTERVAL '30 days'
RETURNING id, order_number, seller_id, buyer_id, status, total_amount;
*/

-- ============================================================================
-- 8. VERIFICAR DESPUÉS DE LA ASIGNACIÓN
-- ============================================================================

SELECT 
  id,
  order_number,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- INSTRUCCIONES:
-- ============================================================================
-- 1. Ejecuta los pasos 1-4 para ver el problema exacto
-- 2. Si ves pedidos "Huérfanos" o "Sin buyer_id/seller_id", ese es el problema
-- 3. Ejecuta el paso 7 (descomenta el UPDATE) para asignarlos a tu usuario
-- 4. Ejecuta el paso 8 para verificar que ahora están asignados
-- 5. Recarga la página del navegador
-- ============================================================================

-- ============================================================================
-- CAUSAS COMUNES DE ESTE PROBLEMA:
-- ============================================================================
-- 1. Bug en el código de checkout que no asigna buyer_id/seller_id
-- 2. Sesión expiró durante el proceso de pago
-- 3. Pedido creado por proceso automatizado sin usuario
-- 4. Error en el trigger o función que crea el pedido
-- ============================================================================
