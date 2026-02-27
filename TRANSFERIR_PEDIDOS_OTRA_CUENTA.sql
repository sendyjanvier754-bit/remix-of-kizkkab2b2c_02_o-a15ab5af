-- ============================================================================
-- TRANSFERIR PEDIDOS DE OTRA CUENTA A MI CUENTA ACTUAL
-- ============================================================================

-- ============================================================================
-- PASO 1: Ver mi usuario actual
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id_actual,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email_actual;

-- ============================================================================
-- PASO 2: Ver a qué usuarios pertenecen los pedidos
-- ============================================================================

SELECT 
  o.seller_id,
  o.buyer_id,
  p_seller.email as seller_email,
  p_buyer.email as buyer_email,
  COUNT(o.id) as cantidad_pedidos,
  SUM(o.total_amount) as total_usd
FROM public.orders_b2b o
LEFT JOIN auth.users p_seller ON o.seller_id = p_seller.id
LEFT JOIN auth.users p_buyer ON o.buyer_id = p_buyer.id
GROUP BY o.seller_id, o.buyer_id, p_seller.email, p_buyer.email
ORDER BY cantidad_pedidos DESC;

-- ============================================================================
-- PASO 3: Ver detalles de pedidos de otros usuarios (últimos 20)
-- ============================================================================

SELECT 
  o.id,
  o.seller_id,
  o.buyer_id,
  p_seller.email as seller_email,
  p_buyer.email as buyer_email,
  o.status,
  o.payment_status,
  o.total_amount,
  o.created_at
FROM public.orders_b2b o
LEFT JOIN auth.users p_seller ON o.seller_id = p_seller.id
LEFT JOIN auth.users p_buyer ON o.buyer_id = p_buyer.id
WHERE o.seller_id != auth.uid() AND o.buyer_id != auth.uid()
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 4: ¿Son pedidos que TÚ hiciste? Verifica los emails
-- ============================================================================
-- Si los emails del PASO 2 incluyen TU email actual o uno que usaste antes,
-- entonces esos pedidos son tuyos y necesitan ser transferidos

-- Ver si hay pedidos de un email específico (reemplaza 'TU_EMAIL@example.com')
/*
SELECT 
  o.id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.created_at,
  p.email
FROM public.orders_b2b o
LEFT JOIN auth.users p ON (o.seller_id = p.id OR o.buyer_id = p.id)
WHERE p.email = 'TU_EMAIL@example.com'
ORDER BY o.created_at DESC;
*/

-- ============================================================================
-- PASO 5: TRANSFERIR PEDIDOS de un usuario específico A TU CUENTA ACTUAL
-- ============================================================================
-- OPCIÓN A: Transferir por UUID específico
-- Reemplaza 'OLD_USER_UUID_HERE' con el UUID del usuario viejo del PASO 2

/*
UPDATE public.orders_b2b
SET 
  seller_id = CASE WHEN seller_id = 'OLD_USER_UUID_HERE'::uuid THEN auth.uid() ELSE seller_id END,
  buyer_id = CASE WHEN buyer_id = 'OLD_USER_UUID_HERE'::uuid THEN auth.uid() ELSE buyer_id END,
  updated_at = NOW()
WHERE seller_id = 'OLD_USER_UUID_HERE'::uuid OR buyer_id = 'OLD_USER_UUID_HERE'::uuid
RETURNING id, status, payment_status, total_amount, created_at;
*/

-- ============================================================================
-- PASO 6: OPCIÓN ALTERNATIVA - Transferir TODOS los pedidos recientes
-- ============================================================================
-- CUIDADO: Esto transferirá TODOS los pedidos de los últimos 30 días a tu cuenta
-- Solo usa esto si ESTÁS SEGURO de que todos los pedidos son tuyos

/*
UPDATE public.orders_b2b
SET 
  seller_id = auth.uid(),
  buyer_id = auth.uid(),
  updated_at = NOW()
WHERE created_at > NOW() - INTERVAL '30 days'
RETURNING id, status, payment_status, total_amount, created_at;
*/

-- ============================================================================
-- PASO 7: Verificar pedidos después de la transferencia
-- ============================================================================

SELECT 
  id,
  status,
  payment_status,
  total_amount,
  created_at
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- PASO 8: Resumen por estado (después de transferencia)
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
-- 1. Ejecuta PASO 1 para ver tu usuario actual
-- 2. Ejecuta PASO 2 para ver QUÉ USUARIOS tienen pedidos
-- 3. Ejecuta PASO 3 para ver los detalles de esos pedidos
-- 
-- LUEGO ELIGE UNA OPCIÓN:
-- 
-- OPCIÓN A (Recomendada): Si reconoces el email/UUID del otro usuario:
--   - Descomenta el UPDATE del PASO 5
--   - Reemplaza 'OLD_USER_UUID_HERE' con el UUID del PASO 2
--   - Ejecuta el UPDATE
-- 
-- OPCIÓN B (Solo si estás seguro): Transferir todos los pedidos recientes:
--   - Descomenta el UPDATE del PASO 6
--   - Ejecuta el UPDATE
-- 
-- 4. Ejecuta PASO 7 y 8 para verificar
-- 5. Recarga la página del navegador
-- ============================================================================

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- • Si los pedidos son de otro usuario real, NO los transfieras
-- • Si son tus pedidos pero de otra cuenta, usa OPCIÓN A
-- • Si cambiaste de cuenta recientemente, revisa el email en PASO 2
-- • Después de transferir, los pedidos aparecerán en "Mis Compras B2B"
-- ============================================================================
