-- =============================================================================
-- VERIFICAR: Peso de las variantes reales del carrito
-- =============================================================================

-- Ver las variantes específicas del carrito con su peso
SELECT 
  '🛒 VARIANTES DEL CARRITO' as info,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.sku,
  pv.peso_kg as "peso_variante",
  p.peso_kg as "peso_producto",
  COALESCE(pv.peso_kg, p.peso_kg, 0) as "peso_final",
  CASE 
    WHEN COALESCE(pv.peso_kg, p.peso_kg, 0) > 0 THEN '✅ TIENE PESO'
    ELSE '❌ SIN PESO'
  END as status
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.id IN (
  '30123456-0123-4567-8901-234567890123',
  '29012345-9012-3456-7890-123456789012'
);

-- Ver el costo de envío calculado
SELECT 
  '💰 COSTO DE ENVÍO' as info,
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  total_cost_with_type,
  shipping_type_display
FROM v_cart_shipping_costs;

-- Si no aparece nada en v_cart_shipping_costs, verificar:
SELECT 
  '🔍 DEBUG' as info,
  COUNT(*) as items_en_carrito
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid();
