-- =============================================================================
-- VERIFICAR: Estado de mi carrito
-- =============================================================================

-- 1. Ver mi carrito activo
SELECT 
  '🛒 MI CARRITO' as info,
  id as cart_id,
  buyer_user_id,
  created_at,
  updated_at
FROM b2b_carts
WHERE buyer_user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- 2. Ver items en mi carrito
SELECT 
  '📦 ITEMS EN MI CARRITO' as info,
  bci.id as item_id,
  p.nombre as producto,
  pv.name as variante,
  bci.quantity as cantidad,
  pv.peso_kg as peso_variante,
  p.peso_kg as peso_producto,
  COALESCE(pv.peso_kg, p.peso_kg, 0) as peso_final,
  COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity as peso_total_item
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = auth.uid()
ORDER BY bci.created_at DESC;

-- 3. Ver costo de envío si hay items
SELECT 
  '💰 COSTO DE ENVÍO' as info,
  cart_id,
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  total_cost_with_type,
  shipping_type_display
FROM v_cart_shipping_costs;

-- 4. Ver mi user_id
SELECT 
  '👤 MI USER ID' as info,
  auth.uid() as my_user_id;
