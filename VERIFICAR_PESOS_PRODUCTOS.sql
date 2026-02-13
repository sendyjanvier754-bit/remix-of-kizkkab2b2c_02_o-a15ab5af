-- =============================================================================
-- VERIFICAR PESOS EN PRODUCTOS Y VARIANTES
-- =============================================================================
-- Este script verifica si los productos tienen peso_kg o peso_g

-- Ver productos en el carrito y sus pesos
SELECT 
  '🔍 PRODUCTOS EN CARRITO' as info,
  p.id,
  p.nombre,
  p.peso_kg,
  p.peso_g,
  CASE 
    WHEN p.peso_kg IS NOT NULL THEN '✅ Tiene peso_kg'
    WHEN p.peso_g IS NOT NULL THEN '✅ Tiene peso_g'
    ELSE '❌ Sin peso'
  END as status_peso
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
GROUP BY p.id, p.nombre, p.peso_kg, p.peso_g;

-- Ver variantes en el carrito y sus pesos
SELECT 
  '🔍 VARIANTES EN CARRITO' as info,
  pv.id,
  p.nombre as producto,
  pv.name as variante,
  pv.peso_kg as variante_peso_kg,
  pv.peso_g as variante_peso_g,
  p.peso_kg as producto_peso_kg,
  p.peso_g as producto_peso_g,
  CASE 
    WHEN pv.peso_kg IS NOT NULL THEN '✅ Variante tiene peso_kg'
    WHEN pv.peso_g IS NOT NULL THEN '✅ Variante tiene peso_g'
    WHEN p.peso_kg IS NOT NULL THEN '⚠️ Usa peso_kg del producto'
    WHEN p.peso_g IS NOT NULL THEN '⚠️ Usa peso_g del producto'
    ELSE '❌ Sin peso'
  END as status_peso
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
  AND bci.variant_id IS NOT NULL;

-- Calcular peso usando COALESCE completo
SELECT 
  '💡 PESO CALCULADO CON COALESCE' as info,
  bci.id as cart_item_id,
  p.nombre as producto,
  pv.name as variante,
  pv.peso_kg as "pv.peso_kg",
  p.peso_kg as "p.peso_kg", 
  pv.peso_g as "pv.peso_g",
  p.peso_g as "p.peso_g",
  COALESCE(
    pv.peso_kg, 
    p.peso_kg, 
    pv.peso_g::numeric / 1000.0, 
    p.peso_g::numeric / 1000.0, 
    0
  ) as peso_final_kg,
  CASE 
    WHEN pv.peso_kg IS NOT NULL THEN 'pv.peso_kg'
    WHEN p.peso_kg IS NOT NULL THEN 'p.peso_kg'
    WHEN pv.peso_g IS NOT NULL THEN 'pv.peso_g / 1000'
    WHEN p.peso_g IS NOT NULL THEN 'p.peso_g / 1000'
    ELSE 'DEFAULT 0'
  END as fuente_peso
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY bci.created_at DESC;

-- Ver estadísticas generales
SELECT 
  '📊 ESTADÍSTICAS GENERALES' as info,
  COUNT(*) as total_productos,
  COUNT(peso_kg) as productos_con_peso_kg,
  COUNT(peso_g) as productos_con_peso_g,
  COUNT(CASE WHEN peso_kg IS NULL AND peso_g IS NULL THEN 1 END) as productos_sin_peso
FROM products
WHERE id IN (
  SELECT DISTINCT product_id 
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
);
