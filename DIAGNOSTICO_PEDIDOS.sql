-- ============================================================================
-- DIAGNÓSTICO COMPLETO: ¿Por qué no se muestran los pedidos?
-- ============================================================================
-- Este script ayuda a identificar el problema exacto
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR QUE HAY DATOS EN orders_b2b
-- ============================================================================

SELECT 
  COUNT(*) as total_pedidos,
  COUNT(DISTINCT seller_id) as total_sellers,
  COUNT(DISTINCT buyer_id) as total_buyers
FROM public.orders_b2b;

-- ============================================================================
-- 2. VER ALGUNOS PEDIDOS DE EJEMPLO (estructura)
-- ============================================================================

SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  currency,
  created_at
FROM public.orders_b2b
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 3. VERIFICAR USUARIO ACTUAL Y SUS ROLES
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id,
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) as soy_admin,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email;

-- ============================================================================
-- 4. VERIFICAR SI EL USUARIO ACTUAL TIENE PEDIDOS
-- ============================================================================

-- Como Seller
SELECT 
  COUNT(*) as pedidos_como_seller
FROM public.orders_b2b
WHERE seller_id = auth.uid();

-- Como Buyer
SELECT 
  COUNT(*) as pedidos_como_buyer
FROM public.orders_b2b
WHERE buyer_id = auth.uid();

-- Como Seller O Buyer
SELECT 
  COUNT(*) as total_mis_pedidos,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendientes,
  SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as pagados,
  SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as enviados,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelados
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid();

-- ============================================================================
-- 5. VERIFICAR POLÍTICAS RLS ACTIVAS
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies
WHERE tablename IN ('orders_b2b', 'order_items_b2b')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 6. PROBAR SELECT DIRECTO (debería funcionar si las políticas están bien)
-- ============================================================================

SELECT 
  o.id,
  o.seller_id,
  o.buyer_id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.created_at,
  COUNT(oi.id) as total_items
FROM public.orders_b2b o
LEFT JOIN public.order_items_b2b oi ON oi.order_id = o.id
WHERE o.seller_id = auth.uid() OR o.buyer_id = auth.uid()
GROUP BY o.id, o.seller_id, o.buyer_id, o.status, o.payment_status, o.total_amount, o.created_at
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. VERIFICAR SI PROFILES PERMITE VER OTROS USUARIOS
-- ============================================================================

SELECT 
  COUNT(*) as total_profiles_visibles
FROM public.profiles;

-- ============================================================================
-- 8. PRUEBA COMPLETA CON JOIN (como en la aplicación)
-- ============================================================================

SELECT 
  o.id,
  o.seller_id,
  o.buyer_id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.created_at,
  seller_profile.email as seller_email,
  buyer_profile.email as buyer_email
FROM public.orders_b2b o
LEFT JOIN public.profiles seller_profile ON o.seller_id = seller_profile.id
LEFT JOIN public.profiles buyer_profile ON o.buyer_id = buyer_profile.id
WHERE o.seller_id = auth.uid() OR o.buyer_id = auth.uid()
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- ============================================================================
-- 
-- Si paso 1 devuelve 0 pedidos:
--   → No hay datos de pedidos en la base de datos
--   → Necesitas crear pedidos de prueba
--
-- Si paso 4 devuelve 0 pedidos:
--   → El usuario actual no tiene pedidos asignados
--   → Verifica que seller_id o buyer_id correspondan al usuario
--
-- Si paso 5 muestra políticas duplicadas o conflictivas:
--   → Ejecuta CLEANUP_OLD_POLICIES.sql
--
-- Si paso 6 falla con error de permisos:
--   → Las políticas RLS no están configuradas correctamente
--   → Ejecuta de nuevo FIX_ORDERS_RLS_COMPLETE.sql
--
-- Si paso 8 falla o no muestra emails:
--   → El problema está en las políticas de profiles
--   → Las políticas de profiles_select_related_orders deberían arreglarlo
--
-- ============================================================================
