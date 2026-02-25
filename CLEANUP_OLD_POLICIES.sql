-- ============================================================================
-- LIMPIAR POLÍTICAS DUPLICADAS Y ANTIGUAS
-- ============================================================================
-- Este script elimina las políticas viejas que están causando conflictos
-- ============================================================================

-- ============================================================================
-- ELIMINAR POLÍTICAS ANTIGUAS DE orders_b2b
-- ============================================================================

DROP POLICY IF EXISTS "Users view own b2b orders" ON public.orders_b2b;
DROP POLICY IF EXISTS "Users create own b2b orders" ON public.orders_b2b;
DROP POLICY IF EXISTS "Users update own b2b orders" ON public.orders_b2b;
DROP POLICY IF EXISTS "Users delete own b2b orders" ON public.orders_b2b;

-- ============================================================================
-- VERIFICAR QUE SOLO QUEDEN LAS POLÍTICAS NUEVAS
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY policyname;

-- ============================================================================
-- DEBERÍAS VER SOLO ESTAS 4 POLÍTICAS:
-- ============================================================================
-- orders_b2b_all_admin (ALL) - {authenticated}
-- orders_b2b_insert_seller (INSERT) - {authenticated}
-- orders_b2b_select_seller (SELECT) - {authenticated}
-- orders_b2b_update_seller (UPDATE) - {authenticated}
-- ============================================================================

-- ============================================================================
-- VERIFICAR QUE LOS PEDIDOS AHORA SE VEAN
-- ============================================================================

-- Cuenta total de pedidos en la base de datos
SELECT COUNT(*) as total_orders FROM public.orders_b2b;

-- Pedidos del usuario actual (seller o buyer)
SELECT 
  id,
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

-- Verificar seller_id y buyer_id del usuario actual
SELECT 
  COUNT(*) as mis_pedidos,
  SUM(CASE WHEN seller_id = auth.uid() THEN 1 ELSE 0 END) as como_seller,
  SUM(CASE WHEN buyer_id = auth.uid() THEN 1 ELSE 0 END) as como_buyer
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid();

-- ============================================================================
-- INSTRUCCIONES:
-- ============================================================================
-- 1. Ejecuta este script en Supabase SQL Editor
-- 2. Verifica que solo quedan 4 políticas para orders_b2b
-- 3. Verifica que la query de pedidos devuelve resultados
-- 4. Recarga la página del navegador (F5)
-- 5. Los pedidos deberían aparecer ahora
-- ============================================================================
