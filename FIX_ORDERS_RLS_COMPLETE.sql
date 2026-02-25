-- ============================================================================
-- SCRIPT COMPLETO PARA CORREGIR RLS EN PEDIDOS B2B
-- ============================================================================
-- Este script corrige todas las políticas RLS para que:
-- 1. Los sellers/buyers vean sus pedidos
-- 2. Los admins vean TODOS los pedidos
-- 3. Los joins funcionen correctamente (products, profiles, order_items_b2b)
-- ============================================================================

-- ============================================================================
-- PASO 1: HABILITAR RLS EN TABLAS SI NO ESTÁ HABILITADO
-- ============================================================================

ALTER TABLE public.orders_b2b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items_b2b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
-- profiles ya tiene RLS habilitado

-- ============================================================================
-- PASO 2: POLÍTICAS PARA orders_b2b
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "orders_b2b_select_seller" ON public.orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_insert_seller" ON public.orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_seller" ON public.orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_admin" ON public.orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_admin" ON public.orders_b2b;

-- Política SELECT: Sellers/Buyers ven sus propios pedidos
CREATE POLICY "orders_b2b_select_seller" ON public.orders_b2b
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- Política INSERT: Sellers/Buyers pueden crear pedidos
CREATE POLICY "orders_b2b_insert_seller" ON public.orders_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- Política UPDATE: Sellers/Buyers pueden actualizar sus propios pedidos
CREATE POLICY "orders_b2b_update_seller" ON public.orders_b2b
FOR UPDATE
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
)
WITH CHECK (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- Política para ADMINS: Pueden ver y modificar TODOS los pedidos
CREATE POLICY "orders_b2b_all_admin" ON public.orders_b2b
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
);

-- ============================================================================
-- PASO 3: POLÍTICAS PARA order_items_b2b
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "order_items_b2b_insert_seller" ON public.order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_select_seller" ON public.order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_update_seller" ON public.order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_all_admin" ON public.order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_select_admin" ON public.order_items_b2b;

-- Política para INSERT: Los sellers pueden crear items de sus propios pedidos
CREATE POLICY "order_items_b2b_insert_seller" ON public.order_items_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
);

-- Política para SELECT: Los sellers/buyers pueden ver items de sus propios pedidos
CREATE POLICY "order_items_b2b_select_seller" ON public.order_items_b2b
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
);

-- Política para UPDATE: Los sellers pueden actualizar items de sus propios pedidos
CREATE POLICY "order_items_b2b_update_seller" ON public.order_items_b2b
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
);

-- Política para ADMINS: Pueden ver y modificar TODOS los items
CREATE POLICY "order_items_b2b_all_admin" ON public.order_items_b2b
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
);

-- ============================================================================
-- PASO 4: POLÍTICAS PARA products (necesario para los joins)
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "products_select_public" ON public.products;
DROP POLICY IF EXISTS "products_select_all" ON public.products;

-- Política SELECT: TODOS los usuarios autenticados pueden ver productos
-- (necesario para que los joins en order_items_b2b funcionen)
CREATE POLICY "products_select_all" ON public.products
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- PASO 5: POLÍTICAS PARA product_variants (necesario para los joins)
-- ============================================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_select_all" ON public.product_variants;

-- Política SELECT: TODOS los usuarios autenticados pueden ver variantes
CREATE POLICY "product_variants_select_all" ON public.product_variants
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- PASO 6: POLÍTICAS PARA profiles (necesario para los joins con seller/buyer)
-- ============================================================================

-- Eliminar políticas antiguas de visualización
DROP POLICY IF EXISTS "profiles_select_related_orders" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- Mantener la política existente de ver su propio perfil
-- (no la eliminamos porque puede estar en uso)

-- Política adicional: Usuarios pueden ver perfiles relacionados con pedidos
CREATE POLICY "profiles_select_related_orders" ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Pueden ver su propio perfil
  auth.uid() = id
  OR
  -- O si hay un pedido donde el usuario actual es seller/buyer y este perfil es el otro participante
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
    AND (orders_b2b.seller_id = profiles.id OR orders_b2b.buyer_id = profiles.id)
  )
  OR
  -- O si es admin
  public.is_admin(auth.uid())
);

-- ============================================================================
-- VERIFICAR POLÍTICAS CREADAS
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('orders_b2b', 'order_items_b2b', 'products', 'product_variants', 'profiles')
ORDER BY tablename, policyname;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- orders_b2b: 4 políticas
--   - orders_b2b_all_admin (ALL)
--   - orders_b2b_insert_seller (INSERT)
--   - orders_b2b_select_seller (SELECT)
--   - orders_b2b_update_seller (UPDATE)
--
-- order_items_b2b: 4 políticas
--   - order_items_b2b_all_admin (ALL)
--   - order_items_b2b_insert_seller (INSERT)
--   - order_items_b2b_select_seller (SELECT)
--   - order_items_b2b_update_seller (UPDATE)
--
-- products: 1 política
--   - products_select_all (SELECT)
--
-- product_variants: 1 política
--   - product_variants_select_all (SELECT)
--
-- profiles: 3 políticas (las 2 existentes + 1 nueva)
--   - profiles_select_related_orders (SELECT) -- NUEVA
--   - Users can view their own profile (SELECT) -- EXISTENTE
--   - Admins can view all profiles (SELECT) -- EXISTENTE (si existe)
-- ============================================================================

-- ============================================================================
-- PRUEBA: Verificar que los pedidos ahora se muestren
-- ============================================================================

-- Como Seller: Deberías ver tus pedidos
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

-- Como Admin: Deberías ver TODOS los pedidos (si eres admin)
-- SELECT 
--   id,
--   seller_id,
--   buyer_id,
--   status,
--   payment_status,
--   total_amount,
--   created_at
-- FROM public.orders_b2b
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Ejecuta este script en Supabase SQL Editor
-- 2. Verifica que la función is_admin() existe (debería existir)
-- 3. Después de ejecutar, recarga las páginas en el navegador
-- 4. Si los pedidos aún no aparecen, verifica que existan datos en orders_b2b
-- 5. Verifica que el usuario tiene seller_id o buyer_id en los pedidos
-- ============================================================================
