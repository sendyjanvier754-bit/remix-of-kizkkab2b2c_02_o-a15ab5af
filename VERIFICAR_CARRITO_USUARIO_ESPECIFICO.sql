-- =============================================================================
-- VERIFICAR: Carrito del usuario específico
-- =============================================================================

-- Usuario: 376067ef-7629-47f1-be38-bbf8d728ddf0

-- 1. Ver carrito del usuario
SELECT 
  '🛒 CARRITO DEL USUARIO' as info,
  id as cart_id,
  buyer_user_id,
  created_at,
  updated_at
FROM b2b_carts
WHERE buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Ver items en el carrito
SELECT 
  '📦 ITEMS EN EL CARRITO' as info,
  bci.id as item_id,
  bc.id as cart_id,
  p.nombre as producto,
  pv.name as variante,
  pv.sku as variante_sku,
  bci.quantity as cantidad,
  pv.peso_kg as peso_variante,
  p.peso_kg as peso_producto,
  COALESCE(pv.peso_kg, p.peso_kg, 0) as peso_final,
  COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity as peso_total_item
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY bci.created_at DESC;

-- 3. Calcular costo de envío manualmente para este usuario
WITH user_cart AS (
  SELECT id as cart_id
  FROM b2b_carts
  WHERE buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
  ORDER BY created_at DESC
  LIMIT 1
),
cart_items_with_weight AS (
  SELECT 
    bci.quantity,
    COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_kg
  FROM b2b_cart_items bci
  JOIN user_cart uc ON bci.cart_id = uc.cart_id
  JOIN products p ON bci.product_id = p.id
  LEFT JOIN product_variants pv ON bci.variant_id = pv.id
)
SELECT 
  '💰 COSTO DE ENVÍO CALCULADO' as info,
  COUNT(*) as total_items,
  SUM(peso_kg * quantity) as total_weight_kg,
  CEIL(SUM(peso_kg * quantity)) as weight_rounded_kg,
  CASE 
    WHEN SUM(peso_kg * quantity) = 0 THEN 0
    WHEN CEIL(SUM(peso_kg * quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(peso_kg * quantity)) - 1) * 5.82)
  END as costo_estimado
FROM cart_items_with_weight;

-- 4. Ver si la vista v_cart_shipping_costs funciona
-- NOTA: Esta vista usa auth.uid(), así que solo funciona cuando estás autenticado en el frontend
-- Aquí simularemos lo que debería retornar
SELECT 
  '🔍 SIMULACIÓN v_cart_shipping_costs' as info,
  uc.cart_id,
  '376067ef-7629-47f1-be38-bbf8d728ddf0'::uuid as buyer_user_id,
  COUNT(*)::INTEGER as total_items,
  SUM(COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) * bci.quantity) as total_weight_kg,
  CEIL(SUM(COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) * bci.quantity))::INTEGER as weight_rounded_kg,
  CASE 
    WHEN SUM(COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(pv.peso_kg, p.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as total_cost_with_type,
  'STANDARD' as shipping_type_name
FROM (
  SELECT id as cart_id
  FROM b2b_carts
  WHERE buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
  ORDER BY created_at DESC
  LIMIT 1
) uc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = uc.cart_id
LEFT JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
GROUP BY uc.cart_id;
