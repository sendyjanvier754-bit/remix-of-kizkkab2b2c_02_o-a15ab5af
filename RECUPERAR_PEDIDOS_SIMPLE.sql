-- ============================================================================
-- RECUPERAR PEDIDOS "PERDIDOS" - VERSIÓN SIMPLE Y SEGURA
-- ============================================================================

-- ============================================================================
-- PASO 1: Ver tu usuario actual
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email;

-- ============================================================================
-- PASO 2: Ver TODOS los pedidos y su estado de asignación
-- ============================================================================

SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at,
  CASE 
    WHEN seller_id IS NULL AND buyer_id IS NULL THEN 'SIN DUEÑO'
    WHEN seller_id IS NULL THEN 'Sin seller_id'
    WHEN buyer_id IS NULL THEN 'Sin buyer_id'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'MIO'
    ELSE 'Otro usuario'
  END as estado
FROM public.orders_b2b
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 3: Contar pedidos por tipo
-- ============================================================================

SELECT 
  CASE 
    WHEN seller_id IS NULL OR buyer_id IS NULL THEN 'Pedidos sin asignar'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'Mis pedidos'
    ELSE 'De otros usuarios'
  END as tipo,
  COUNT(*) as cantidad
FROM public.orders_b2b
GROUP BY 
  CASE 
    WHEN seller_id IS NULL OR buyer_id IS NULL THEN 'Pedidos sin asignar'
    WHEN seller_id = auth.uid() OR buyer_id = auth.uid() THEN 'Mis pedidos'
    ELSE 'De otros usuarios'
  END;

-- ============================================================================
-- PASO 4: Ver pedidos sin buyer_id de los últimos 30 días
-- ============================================================================

SELECT 
  COUNT(*) as pedidos_a_recuperar,
  SUM(total_amount) as total_valor_usd
FROM public.orders_b2b
WHERE buyer_id IS NULL
AND created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- PASO 5: RECUPERAR PEDIDOS (descomenta para ejecutar)
-- ============================================================================
-- IMPORTANTE: Esto asignará los pedidos sin buyer_id a tu usuario

UPDATE public.orders_b2b
SET 
  buyer_id = auth.uid(),
  updated_at = NOW()
WHERE buyer_id IS NULL
AND created_at > NOW() - INTERVAL '30 days'
RETURNING id, status, payment_status, total_amount, created_at;

-- ============================================================================
-- PASO 6: Verificar que ahora tienes pedidos asignados
-- ============================================================================

SELECT 
  id,
  status,
  payment_status,
  total_amount,
  total_quantity,
  created_at
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- PASO 7: Ver resumen por estado
-- ============================================================================

SELECT 
  status,
  payment_status,
  COUNT(*) as cantidad,
  SUM(total_amount) as total_usd
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
GROUP BY status, payment_status
ORDER BY status;

-- ============================================================================
-- INSTRUCCIONES:
-- ============================================================================
-- 1. Ejecuta PASO 1 para confirmar tu usuario
-- 2. Ejecuta PASO 2 y 3 para ver el problema
-- 3. Ejecuta PASO 4 para ver cuántos pedidos recuperarás
-- 4. Ejecuta PASO 5 (el UPDATE) para recuperar tus pedidos
-- 5. Ejecuta PASO 6 y 7 para verificar
-- 6. Recarga la página del navegador (F5)
-- ============================================================================
