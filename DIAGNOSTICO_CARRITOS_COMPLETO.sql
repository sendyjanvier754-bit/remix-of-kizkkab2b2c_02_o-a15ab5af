-- =============================================================================
-- DIAGNÓSTICO COMPLETO: Buscar carrito activo y sus items
-- =============================================================================

-- Usuario: 376067ef-7629-47f1-be38-bbf8d728ddf0

-- PASO 1: Ver TODOS los carritos del usuario
SELECT 
  '🛒 TODOS LOS CARRITOS' as info,
  id as cart_id,
  buyer_user_id,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM b2b_cart_items WHERE cart_id = b2b_carts.id) as items_count
FROM b2b_carts
WHERE buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY created_at DESC
LIMIT 10;

-- PASO 2: Ver TODOS los items de TODOS los carritos del usuario
SELECT 
  '📦 ITEMS EN TODOS LOS CARRITOS' as info,
  bc.id as cart_id,
  bci.id as item_id,
  p.id as product_id,
  p.nombre as producto,
  p.peso_kg as producto_peso_kg,
  pv.id as variant_id,
  pv.name as variante,
  pv.peso_kg as variante_peso_kg,
  bci.quantity,
  COALESCE(pv.peso_kg, p.peso_kg, 0) as peso_final,
  bci.created_at as item_created_at,
  CASE 
    WHEN pv.peso_kg IS NOT NULL THEN '✅ Variante con peso'
    WHEN p.peso_kg IS NOT NULL THEN '⚠️ Solo producto con peso'
    ELSE '❌ SIN PESO'
  END as status
FROM b2b_carts bc
JOIN b2b_cart_items bci ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY bci.created_at DESC;

-- PASO 3: Ver cuántos items tiene cada carrito
SELECT 
  '📊 RESUMEN DE CARRITOS' as info,
  bc.id as cart_id,
  COUNT(bci.id) as total_items,
  SUM(COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity) as peso_total,
  bc.created_at,
  bc.updated_at
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
LEFT JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
GROUP BY bc.id, bc.created_at, bc.updated_at
ORDER BY bc.created_at DESC;
