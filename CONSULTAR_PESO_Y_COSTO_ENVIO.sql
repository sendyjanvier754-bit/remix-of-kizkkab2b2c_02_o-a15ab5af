-- =============================================================================
-- CONSULTAR PESO Y COSTO DE ENVÍO DEL CARRITO REAL
-- =============================================================================

-- Ver todos los carritos abiertos actuales
SELECT 
  '🛒 CARRITOS ABIERTOS' as info,
  bc.id as cart_id,
  bc.buyer_user_id,
  u.email as buyer_email,
  COUNT(bci.id) as total_items,
  SUM(bci.quantity) as total_quantity,
  bc.created_at,
  bc.updated_at
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
LEFT JOIN auth.users u ON bc.buyer_user_id = u.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.buyer_user_id, u.email, bc.created_at, bc.updated_at
ORDER BY bc.updated_at DESC;

-- Ver items individuales con su peso
SELECT 
  '📦 ITEMS EN CARRITO' as info,
  bc.id as cart_id,
  bci.id as item_id,
  p.nombre as producto,
  pv.name as variante,
  bci.sku,
  bci.quantity,
  bci.peso_kg as "peso_unitario_kg",
  (bci.peso_kg * bci.quantity) as "peso_total_item_kg",
  bci.unit_price as "precio_unitario",
  bci.total_price as "precio_total_item"
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
ORDER BY bc.updated_at DESC, bci.created_at DESC;

-- Ver resumen total por cada carrito
SELECT 
  '💰 RESUMEN POR CARRITO' as info,
  bc.id as cart_id,
  u.email as buyer_email,
  COUNT(bci.id) as "total_items",
  SUM(bci.quantity) as "total_quantity",
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as "peso_total_kg",
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as "peso_redondeado_kg",
  SUM(bci.total_price) as "subtotal_productos",
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as "costo_envio",
  SUM(bci.total_price) + 
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as "total_con_envio"
FROM b2b_carts bc
JOIN b2b_cart_items bci ON bci.cart_id = bc.id
LEFT JOIN auth.users u ON bc.buyer_user_id = u.id
WHERE bc.status = 'open'
GROUP BY bc.id, u.email
ORDER BY bc.updated_at DESC;

-- Ver desglose del cálculo de envío por carrito
SELECT 
  '📊 DESGLOSE DE COSTO DE ENVÍO' as info,
  bc.id as cart_id,
  u.email as buyer_email,
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as "peso_exacto_kg",
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as "peso_redondeado_kg",
  CASE 
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 
      'Base: $11.05 (≤ 1 kg)'
    ELSE 
      CONCAT(
        'Base: $11.05 + ',
        (CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1),
        ' kg adicionales × $5.82 = $',
        11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
      )
  END as "calculo",
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as "costo_final"
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
LEFT JOIN auth.users u ON bc.buyer_user_id = u.id
WHERE bc.status = 'open'
GROUP BY bc.id, u.email
ORDER BY bc.updated_at DESC;

-- =============================================================================
-- EJEMPLOS DE CÁLCULO
-- =============================================================================
/*
FÓRMULA DE COSTO DE ENVÍO:
==========================
- Si peso = 0 kg → Costo = $0
- Si peso ≤ 1 kg → Costo = $11.05 (tarifa base)
- Si peso > 1 kg → Costo = $11.05 + (peso_redondeado - 1) × $5.82

EJEMPLOS:
---------
Peso exacto: 0.3 kg → Redondeado: 1 kg → Costo: $11.05
Peso exacto: 1.2 kg → Redondeado: 2 kg → Costo: $11.05 + (2-1) × $5.82 = $16.87
Peso exacto: 3.6 kg → Redondeado: 4 kg → Costo: $11.05 + (4-1) × $5.82 = $28.51
Peso exacto: 5.8 kg → Redondeado: 6 kg → Costo: $11.05 + (6-1) × $5.82 = $40.15

TU CASO ACTUAL:
===============
12 items × 0.3 kg = 3.6 kg → 4 kg redondeado
Costo = $11.05 + (4-1) × $5.82 = $11.05 + $17.46 = $28.51 ✅
*/
