-- ===========================================================================
-- DIAGNÓSTICO: ¿Por qué el carrito muestra $5.00 en vez de $14.52?
-- ===========================================================================

-- Test 1: Ver items en tu carrito actual
SELECT 
  '🛒 Items en tu carrito' as info,
  ci.id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  pv.name as variante,
  COALESCE(pv.weight_g, p.weight_g, 0) as peso_gramos,
  COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 as peso_kg,
  (COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 * ci.quantity) as peso_total_kg
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = auth.uid()
  AND c.status = 'open'
ORDER BY ci.id;


-- Test 2: ¿Qué devuelve la vista dinámica?
SELECT 
  '📊 Vista v_cart_shipping_costs' as info,
  total_items,
  ROUND(total_weight_kg::numeric, 3) as peso_kg,
  weight_rounded_kg as peso_redondeado,
  ROUND(base_cost::numeric, 2) as costo_base,
  ROUND(total_cost_with_type::numeric, 2) as total_costo_usd,
  shipping_type_display
FROM v_cart_shipping_costs;


-- Test 3: ¿Qué devuelve la función directa?
SELECT 
  '⚙️ Función get_user_cart_shipping_cost' as info,
  (result->>'total_items')::integer as total_items,
  ROUND((result->>'total_weight_kg')::numeric, 3) as peso_kg,
  (result->>'weight_rounded_kg')::numeric as peso_redondeado,
  ROUND((result->>'base_cost')::numeric, 2) as costo_base,
  ROUND((result->>'total_cost_with_type')::numeric, 2) as total_costo_usd
FROM (
  SELECT get_user_cart_shipping_cost(auth.uid()) as result
) sub;


-- Test 4: Calcular MANUALMENTE como debería ser
WITH peso_total AS (
  SELECT 
    SUM(COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 * ci.quantity) as peso_kg
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  LEFT JOIN products p ON ci.product_id = p.id
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  WHERE c.buyer_user_id = auth.uid()
    AND c.status = 'open'
)
SELECT 
  '🧮 Cálculo Manual' as info,
  peso_kg as peso_total,
  CEIL(peso_kg) as peso_redondeado,
  (CEIL(peso_kg) * 3.50) as tramo_a_usd,
  (CEIL(peso_kg) * 2.20462 * 5.00) as tramo_b_usd,
  (CEIL(peso_kg) * 3.50 + CEIL(peso_kg) * 2.20462 * 5.00) as total_esperado_usd
FROM peso_total;


-- Test 5: ¿Tienen peso configurado los productos?
SELECT 
  '⚠️ Verificar pesos de productos' as info,
  p.id as product_id,
  p.weight_g as "Peso Producto (g)",
  pv.id as variant_id,
  pv.name as variante,
  pv.weight_g as "Peso Variante (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) as "Peso Usado (g)",
  CASE 
    WHEN COALESCE(pv.weight_g, p.weight_g, 0) = 0 THEN '❌ SIN PESO'
    ELSE '✅ OK'
  END as estado
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = auth.uid()
  AND c.status = 'open';


-- Test 6: Ver el JSONB que se construye para la función
WITH cart_array AS (
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as items
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.buyer_user_id = auth.uid()
    AND c.status = 'open'
)
SELECT 
  '📦 Array JSONB para función' as info,
  jsonb_pretty(items) as cart_items_array
FROM cart_array;


-- =============================================================================
-- RESULTADO ESPERADO vs ACTUAL
-- =============================================================================

/*
Si tienes 2 variantes de 0.300 kg cada una:

ESPERADO:
=========
- Peso total: 0.600 kg
- Peso redondeado: 1 kg (CEIL)
- Tramo A: 1 × 3.50 = $3.50
- Tramo B: 1 × 2.20462 × 5.00 = $11.02
- TOTAL: $14.52 USD ✅

ACTUAL (según frontend):
========================
- Total mostrado: $5.00 ❌

POSIBLES CAUSAS:
================
1. ❌ Productos sin peso configurado (weight_g = 0 o NULL)
2. ❌ Vista no actualizada (aún usa 10 productos fijos)
3. ❌ Frontend usando valor cacheado antiguo
4. ❌ Error en la función calculate_cart_shipping_cost_dynamic
5. ❌ Constantes de precio incorrectas (Tramo A/B)
*/
