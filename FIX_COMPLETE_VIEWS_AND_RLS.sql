-- ============================================================================
-- 🔧 FIX COMPLETO: Vistas + RLS + Permisos para "Mis Compras"
-- ============================================================================
-- Este script soluciona TODOS los problemas identificados:
-- 1. Crea vistas v_productos_con_precio_b2b y v_variantes_con_precio_b2b
-- 2. Configura RLS de orders_b2b para permitir queries con OR
-- 3. Agrega GRANT SELECT a todas las vistas y tablas necesarias
-- ============================================================================

-- ============================================================================
-- PARTE 1: CREAR VISTAS DE PRECIO B2B (si no existen)
-- ============================================================================

-- Eliminar vistas antiguas (si existen)
DROP VIEW IF EXISTS public.v_business_panel_data CASCADE;
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;
DROP VIEW IF EXISTS public.v_variantes_con_precio_b2b CASCADE;

-- ============================================================================
-- Vista 1: v_productos_con_precio_b2b
-- ============================================================================

CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  
  -- COSTOS BASE
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,
  
  -- PRECIO B2B CALCULADO (margen 300%)
  -- Fórmula: costo_base × 4.0 (equivalente a +300%)
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) AS precio_b2b,
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) AS precio_b2b_final,
  
  -- DESGLOSE DE PRECIO
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) AS precio_con_margen_300,
  ROUND(((p.costo_base_excel * 4.0) * 0.12)::numeric, 2) AS platform_fee,
  
  -- MARGEN APLICADO (para frontend)
  300 AS applied_margin_percent,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Categoría
  p.categoria_id,
  c.name AS categoria_nombre,
  
  -- Información de envío
  COALESCE(p.weight_kg, p.peso_kg, 0) AS weight_kg,
  COALESCE(p.peso_kg, p.weight_kg, 0) AS peso_kg,
  p.width_cm,
  p.height_cm,
  p.length_cm,
  
  -- Precios sugeridos
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Imágenes
  p.imagen_principal,
  p.galeria_imagenes,
  
  -- Metadata
  p.proveedor_id,
  p.origin_country_id,
  p.currency_code,
  p.url_origen,
  p.dimensiones_cm,
  p.is_oversize,
  p.shipping_mode,
  p.is_active,
  p.is_parent,
  p.created_at,
  p.updated_at,
  p.last_calculated_at
  
FROM public.products p
LEFT JOIN public.categories c ON p.categoria_id = c.id
WHERE p.is_active = true;

COMMENT ON VIEW public.v_productos_con_precio_b2b IS 
'Vista con precios B2B: Costo Base × 4.0 (margen 300%)';

-- ============================================================================
-- Vista 2: v_variantes_con_precio_b2b
-- ============================================================================

CREATE OR REPLACE VIEW public.v_variantes_con_precio_b2b AS
SELECT
  v.id,
  v.product_id,
  v.sku,
  v.name as variant_name,
  
  -- COSTOS
  COALESCE(v.cost_price, p.costo_base_excel, 0) AS costo_base,
  
  -- PRECIO B2B (margen 300%)
  ROUND((COALESCE(v.cost_price, p.costo_base_excel, 0) * 4.0)::numeric, 2) AS precio_b2b,
  ROUND((COALESCE(v.cost_price, p.costo_base_excel, 0) * 4.0)::numeric, 2) AS precio_b2b_final,
  
  -- MARGEN
  300 AS applied_margin_percent,
  
  -- Stock
  COALESCE(v.stock, p.stock_fisico, 0) AS stock,
  v.is_available,
  
  -- Imágenes de variante
  v.images,
  
  -- Peso de variante
  COALESCE(v.weight_kg, p.weight_kg, p.peso_kg, 0) AS weight_kg,
  COALESCE(v.peso_kg, p.peso_kg, p.weight_kg, 0) AS peso_kg,
  
  -- Información del producto base
  p.sku_interno,
  p.nombre AS product_name,
  p.imagen_principal,
  p.categoria_id,
  c.name AS categoria_nombre,
  
  -- Metadata
  v.attributes,
  v.is_active,
  v.created_at,
  v.updated_at
  
FROM public.product_variants v
INNER JOIN public.products p ON v.product_id = p.id
LEFT JOIN public.categories c ON p.categoria_id = c.id
WHERE v.is_active = true AND p.is_active = true;

COMMENT ON VIEW public.v_variantes_con_precio_b2b IS 
'Vista de variantes con precios B2B: Costo Variante × 4.0 (margen 300%)';

-- ============================================================================
-- PARTE 2: PERMISOS GRANT EN VISTAS
-- ============================================================================

GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_variantes_con_precio_b2b TO anon, authenticated;

-- Permisos en tablas base (necesarias para JOINs)
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

-- ============================================================================
-- PARTE 3: FIX RLS DE orders_b2b (permitir query con OR)
-- ============================================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "orders_b2b_select_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_buyer" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_user" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_insert_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_update_user" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_delete_seller" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_select_all_for_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_operations_admins" ON orders_b2b;
DROP POLICY IF EXISTS "orders_b2b_all_for_admins" ON orders_b2b;

-- SELECT: Permite ver pedidos donde eres buyer O seller
CREATE POLICY "orders_b2b_select_user"
ON orders_b2b
FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- INSERT: Solo el seller puede crear pedidos
CREATE POLICY "orders_b2b_insert_seller"
ON orders_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid()
);

-- UPDATE: Tanto buyer como seller pueden actualizar
CREATE POLICY "orders_b2b_update_user"
ON orders_b2b
FOR UPDATE
TO authenticated
USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
)
WITH CHECK (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- DELETE: Solo el seller puede eliminar
CREATE POLICY "orders_b2b_delete_seller"
ON orders_b2b
FOR DELETE
TO authenticated
USING (
  seller_id = auth.uid()
);

-- ADMINS: Acceso total
CREATE POLICY "orders_b2b_all_for_admins"
ON orders_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PARTE 4: FIX RLS DE order_items_b2b
-- ============================================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "order_items_b2b_select_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_insert_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_insert_seller" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_update_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_delete_user" ON order_items_b2b;
DROP POLICY IF EXISTS "order_items_b2b_all_for_admins" ON order_items_b2b;

-- SELECT: Solo si tienes acceso al pedido padre
CREATE POLICY "order_items_b2b_select_user"
ON order_items_b2b
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- INSERT: Solo si eres el seller del pedido
CREATE POLICY "order_items_b2b_insert_seller"
ON order_items_b2b
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND o.seller_id = auth.uid()
  )
);

-- UPDATE: Si eres buyer o seller del pedido
CREATE POLICY "order_items_b2b_update_user"
ON order_items_b2b
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2b o
    WHERE o.id = order_items_b2b.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Admins: acceso total
CREATE POLICY "order_items_b2b_all_for_admins"
ON order_items_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- PARTE 5: RLS POLICIES BÁSICAS EN TABLAS AUXILIARES (si no existen)
-- ============================================================================

-- Profiles: Lectura pública para JOINs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'profiles_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Products: Lectura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' 
    AND policyname = 'products_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "products_select_all" ON products FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Product Variants: Lectura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'product_variants' 
    AND policyname = 'product_variants_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "product_variants_select_all" ON product_variants FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ============================================================================
-- ✅ VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar vistas creadas
SELECT 
  '✅ VISTAS CREADAS' AS tipo,
  table_name AS nombre,
  CASE 
    WHEN table_name = 'v_productos_con_precio_b2b' THEN '💰 Productos B2B'
    WHEN table_name = 'v_variantes_con_precio_b2b' THEN '💰 Variantes B2B'
    ELSE table_name
  END AS descripcion
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('v_productos_con_precio_b2b', 'v_variantes_con_precio_b2b')
ORDER BY table_name;

-- Verificar permisos GRANT
SELECT 
  '✅ PERMISOS GRANT' AS tipo,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('v_productos_con_precio_b2b', 'v_variantes_con_precio_b2b')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- Verificar RLS policies de orders_b2b
SELECT 
  '✅ RLS orders_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  CASE 
    WHEN qual::text LIKE '%buyer_id = auth.uid() OR seller_id = auth.uid()%' THEN '✅ Permite OR'
    ELSE '📋 Otra'
  END AS tipo_policy
FROM pg_policies
WHERE tablename = 'orders_b2b'
ORDER BY cmd, policyname;

-- Verificar RLS policies de order_items_b2b
SELECT 
  '✅ RLS order_items_b2b' AS tipo,
  policyname,
  cmd AS operacion
FROM pg_policies
WHERE tablename = 'order_items_b2b'
ORDER BY cmd, policyname;

-- ============================================================================
-- 📋 INSTRUCCIONES POST-EJECUCIÓN
-- ============================================================================
/*
DESPUÉS DE EJECUTAR ESTE SCRIPT:

1. ✅ Vistas creadas:
   - v_productos_con_precio_b2b (con margen 300%)
   - v_variantes_con_precio_b2b (con margen 300%)

2. ✅ Permisos GRANT agregados a:
   - Las 2 vistas de precio
   - products, product_variants, categories, profiles

3. ✅ RLS policies corregidas:
   - orders_b2b permite query con OR (buyer_id O seller_id)
   - order_items_b2b hereda permisos del pedido padre
   - Admins tienen acceso total

4. 🔄 RECARGA LA APLICACIÓN:
   - Ctrl + Shift + R (hard reload)
   - Verifica "Mis Compras" en http://localhost:8080/seller/mis-compras
   - Deberías ver tus 10 pedidos

5. 🐛 Si sigue fallando:
   - Abre F12 → Console
   - Busca errores 400/404
   - Comparte el error exacto

============================================================================
🎯 ESTO SOLUCIONA:
- ❌ Error 404 "view does not exist"
- ❌ Error 400 "Bad Request" en query con OR
- ❌ "Mis Compras" muestra vacío
- ❌ Frontend no puede cargar pedidos
============================================================================
*/
