-- =============================================================================
-- VERIFICAR: ¿Las funciones y vistas consultan correctamente las tablas B2B?
-- =============================================================================

-- PASO 1: Ver definición completa de la vista v_cart_shipping_costs
SELECT 
  '🔍 Definición de v_cart_shipping_costs' as info,
  pg_get_viewdef('v_cart_shipping_costs'::regclass, true) as definicion;


-- PASO 2: Ver definición de la función get_cart_shipping_cost
SELECT 
  '⚙️ Definición de get_cart_shipping_cost' as info,
  pg_get_functiondef('get_cart_shipping_cost(jsonb)'::regprocedure) as definicion;


-- PASO 3: Ver definición de la función calculate_cart_shipping_cost_dynamic
SELECT 
  '⚙️ Definición de calculate_cart_shipping_cost_dynamic' as info,
  pg_get_functiondef('calculate_cart_shipping_cost_dynamic(jsonb)'::regprocedure) as definicion;


-- PASO 4: Verificar datos en las tablas del carrito B2B
-- 4.1: Ver carritos activos
SELECT 
  '🛒 Carritos B2B (b2b_carts)' as info,
  c.id as cart_id,
  c.buyer_user_id,
  au.email,
  c.status,
  c.created_at,
  c.updated_at
FROM public.b2b_carts c
LEFT JOIN auth.users au ON c.buyer_user_id = au.id
WHERE c.status = 'open'
ORDER BY c.updated_at DESC
LIMIT 10;


-- 4.2: Ver items en los carritos activos
SELECT 
  '📦 Items en carritos B2B (b2b_cart_items)' as info,
  ci.id as cart_item_id,
  ci.cart_id,
  c.buyer_user_id,
  au.email as buyer_email,
  ci.product_id,
  p.nombre as product_name,
  ci.variant_id,
  pv.name as variant_name,
  ci.quantity,
  ci.created_at
FROM public.b2b_cart_items ci
JOIN public.b2b_carts c ON ci.cart_id = c.id
LEFT JOIN auth.users au ON c.buyer_user_id = au.id
LEFT JOIN public.products p ON ci.product_id = p.id
LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open'
ORDER BY ci.created_at DESC
LIMIT 20;


-- PASO 5: Verificar específicamente el carrito del usuario rsdorvil21@gmail.com
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '👤 Carrito del usuario rsdorvil21@gmail.com' as info,
  c.id as cart_id,
  c.status,
  c.created_at,
  COUNT(ci.id) as cantidad_items
FROM public.b2b_carts c
CROSS JOIN user_data
LEFT JOIN public.b2b_cart_items ci ON ci.cart_id = c.id
WHERE c.buyer_user_id = user_data.user_id
GROUP BY c.id, c.status, c.created_at
ORDER BY c.created_at DESC;


-- PASO 6: Verificar qué tablas consulta la función calculate_cart_shipping_cost_dynamic
-- Buscar referencias a tablas en el código de la función
SELECT 
  '🔎 Tablas referenciadas en calculate_cart_shipping_cost_dynamic' as info,
  CASE 
    WHEN pg_get_functiondef('calculate_cart_shipping_cost_dynamic(jsonb)'::regprocedure) LIKE '%products%' THEN 'products ✅'
    ELSE 'products ❌'
  END as tabla_products,
  CASE 
    WHEN pg_get_functiondef('calculate_cart_shipping_cost_dynamic(jsonb)'::regprocedure) LIKE '%product_variants%' THEN 'product_variants ✅'
    ELSE 'product_variants ❌'
  END as tabla_variants,
  CASE 
    WHEN pg_get_functiondef('calculate_cart_shipping_cost_dynamic(jsonb)'::regprocedure) LIKE '%peso_kg%' THEN 'peso_kg ✅'
    ELSE 'peso_kg ❌'
  END as campo_peso_kg,
  CASE 
    WHEN pg_get_functiondef('calculate_cart_shipping_cost_dynamic(jsonb)'::regprocedure) LIKE '%peso_g%' THEN 'peso_g ✅'
    ELSE 'peso_g ❌'
  END as campo_peso_g;


-- PASO 7: Verificar qué tablas consulta la vista v_cart_shipping_costs
SELECT 
  '🔎 Tablas referenciadas en v_cart_shipping_costs' as info,
  CASE 
    WHEN pg_get_viewdef('v_cart_shipping_costs'::regclass) LIKE '%b2b_cart_items%' THEN 'b2b_cart_items ✅'
    ELSE 'b2b_cart_items ❌'
  END as tabla_cart_items,
  CASE 
    WHEN pg_get_viewdef('v_cart_shipping_costs'::regclass) LIKE '%b2b_carts%' THEN 'b2b_carts ✅'
    ELSE 'b2b_carts ❌'
  END as tabla_carts,
  CASE 
    WHEN pg_get_viewdef('v_cart_shipping_costs'::regclass) LIKE '%auth.uid()%' THEN 'auth.uid() ✅'
    ELSE 'auth.uid() ❌'
  END as usa_auth_uid,
  CASE 
    WHEN pg_get_viewdef('v_cart_shipping_costs'::regclass) LIKE '%get_cart_shipping_cost%' THEN 'get_cart_shipping_cost() ✅'
    ELSE 'get_cart_shipping_cost() ❌'
  END as llama_funcion;


-- PASO 8: Test directo - ¿La función puede obtener datos de products?
-- Intentar consultar un producto específico del carrito
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
first_cart_item AS (
  SELECT ci.product_id, ci.variant_id
  FROM public.b2b_cart_items ci
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
  LIMIT 1
)
SELECT 
  '🧪 Test: ¿La función puede acceder a products?' as info,
  fci.product_id,
  p.nombre,
  p.peso_kg as "peso_kg_product",
  p.peso_g as "peso_g_product",
  fci.variant_id,
  pv.name as variant_name,
  pv.peso_kg as "peso_kg_variant",
  pv.peso_g as "peso_g_variant",
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as "peso_calculado_kg"
FROM first_cart_item fci
LEFT JOIN public.products p ON fci.product_id = p.id
LEFT JOIN public.product_variants pv ON fci.variant_id = pv.id;


-- PASO 9: Verificar permisos RLS en las tablas
SELECT 
  '🔒 Políticas RLS en b2b_cart_items' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'b2b_cart_items';

SELECT 
  '🔒 Políticas RLS en b2b_carts' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'b2b_carts';


-- =============================================================================
-- RESUMEN DE VERIFICACIÓN
-- =============================================================================
/*
Este script verifica:

1. ✅ Definición completa de v_cart_shipping_costs
2. ✅ Definición completa de get_cart_shipping_cost()
3. ✅ Definición completa de calculate_cart_shipping_cost_dynamic()
4. ✅ Datos en b2b_carts y b2b_cart_items
5. ✅ Carrito específico del usuario
6. ✅ Tablas que consulta la función
7. ✅ Tablas que consulta la vista
8. ✅ Test de acceso a products/variants
9. ✅ Políticas RLS que podrían afectar

PROBLEMAS COMUNES:
==================
- Vista muestra 0: auth.uid() es NULL en SQL Editor
- Función no encuentra datos: RLS bloqueando acceso
- Peso NULL: Productos sin peso_kg/peso_g configurado
- Items vacíos: No hay productos en el carrito del usuario
- Error al consultar: Función no existe o está mal definida
*/
