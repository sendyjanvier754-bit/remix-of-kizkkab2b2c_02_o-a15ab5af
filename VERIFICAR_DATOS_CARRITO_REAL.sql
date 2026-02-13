-- =============================================================================
-- VERIFICAR DATOS REALES DEL CARRITO
-- =============================================================================

-- 1. Ver todos los carritos abiertos (sin filtro de usuario)
SELECT 
  '🛒 TODOS LOS CARRITOS ABIERTOS' as info,
  bc.id as cart_id,
  bc.buyer_user_id,
  bc.status,
  COUNT(bci.id) as items_count,
  SUM(bci.quantity) as total_quantity,
  bc.created_at
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.buyer_user_id, bc.status, bc.created_at
ORDER BY bc.created_at DESC;

-- 2. Ver items de cada carrito con su peso
SELECT 
  '📦 ITEMS DE CARRITOS' as info,
  bc.id as cart_id,
  bci.id as item_id,
  p.nombre as producto,
  pv.name as variante,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total,
  bci.total_price
FROM b2b_carts bc
JOIN b2b_cart_items bci ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
ORDER BY bc.id, bci.created_at;

-- 3. Resumen por carrito
SELECT 
  '💰 RESUMEN POR CARRITO' as info,
  bc.id as cart_id,
  COUNT(bci.id) as total_items,
  SUM(bci.quantity) as total_quantity,
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as total_weight_kg,
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as weight_rounded_kg,
  SUM(bci.total_price) as subtotal,
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as shipping_cost
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id;

-- 4. Probar la vista con auth.uid() simulado
SELECT 
  '🔍 SIMULAR VISTA (sin auth.uid)' as info,
  bc.id as cart_id,
  bc.buyer_user_id,
  COUNT(bci.id) as total_items,
  SUM(bci.quantity) as total_quantity,
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as total_weight_kg,
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as weight_rounded_kg,
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as total_cost_with_type
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.buyer_user_id;
