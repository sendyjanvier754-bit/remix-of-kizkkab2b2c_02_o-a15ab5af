-- =============================================================================
-- VERIFICAR: Estructura de las tablas del carrito B2B
-- =============================================================================

-- PASO 1: Ver todas las columnas de la tabla b2b_carts
SELECT 
  '📋 Columnas de b2b_carts' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'b2b_carts'
ORDER BY ordinal_position;


-- PASO 2: Ver todas las columnas de la tabla b2b_cart_items
SELECT 
  '📋 Columnas de b2b_cart_items' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'b2b_cart_items'
ORDER BY ordinal_position;


-- PASO 3: Ver algunos datos reales de b2b_carts
SELECT 
  '🛒 Datos reales en b2b_carts' as info,
  *
FROM b2b_carts
WHERE status = 'open'
LIMIT 5;


-- PASO 4: Ver algunos datos reales de b2b_cart_items
SELECT 
  '📦 Datos reales en b2b_cart_items' as info,
  *
FROM b2b_cart_items
LIMIT 5;


-- PASO 5: Ver relación entre las tablas
SELECT 
  '🔗 Relación b2b_carts <-> b2b_cart_items' as info,
  c.id as cart_id,
  c.buyer_user_id,
  au.email,
  c.status,
  COUNT(ci.id) as total_items_en_carrito
FROM b2b_carts c
LEFT JOIN auth.users au ON c.buyer_user_id = au.id
LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
WHERE c.status = 'open'
GROUP BY c.id, c.buyer_user_id, au.email, c.status
ORDER BY c.updated_at DESC
LIMIT 10;


-- =============================================================================
-- RESUMEN
-- =============================================================================
/*
Este script verifica:
1. ✅ Qué columnas tiene b2b_carts (incluyendo si tiene 'id')
2. ✅ Qué columnas tiene b2b_cart_items (incluyendo si tiene 'cart_id')
3. ✅ Datos reales para ver el formato
4. ✅ Cómo se relacionan las tablas

RESULTADO ESPERADO:
===================
- b2b_carts debería tener: id, buyer_user_id, status, created_at, updated_at
- b2b_cart_items debería tener: id, cart_id, product_id, variant_id, quantity, etc.
- cart_id en b2b_cart_items hace referencia a id en b2b_carts
*/
