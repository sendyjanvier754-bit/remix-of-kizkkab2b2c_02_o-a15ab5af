-- =============================================================================
-- DIAGNÓSTICO: ¿Por qué sigue mostrando $5.00?
-- Vamos a simular EXACTAMENTE lo que hace la vista pero sin auth.uid()
-- =============================================================================

-- PASO 1: Ver qué items tienes en tu carrito
SELECT 
  '📦 Items en carritos abiertos' as diagnostico,
  c.buyer_user_id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  p.nombre,
  p.peso_kg,
  p.peso_g,
  COALESCE(p.peso_kg, p.peso_g::numeric / 1000.0, 0) as peso_calculado_kg
FROM b2b_carts c
JOIN b2b_cart_items ci ON c.id = ci.cart_id
LEFT JOIN products p ON ci.product_id = p.id
WHERE c.status = 'open'
ORDER BY c.buyer_user_id, ci.id
LIMIT 20;

-- =============================================================================

-- PASO 2: Construir el JSONB exactamente como la vista
WITH user_cart AS (
  SELECT 
    c.buyer_user_id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as items
  FROM b2b_carts c
  JOIN b2b_cart_items ci ON c.id = ci.cart_id
  WHERE c.status = 'open'
    AND ci.product_id IS NOT NULL
  GROUP BY c.buyer_user_id
)
SELECT 
  '🧪 Array de items por usuario' as test,
  buyer_user_id,
  items,
  jsonb_array_length(items) as cantidad_items
FROM user_cart
LIMIT 5;

-- =============================================================================

-- PASO 3: Llamar a la función con los items reales del primer usuario
WITH user_cart AS (
  SELECT 
    c.buyer_user_id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as items
  FROM b2b_carts c
  JOIN b2b_cart_items ci ON c.id = ci.cart_id
  WHERE c.status = 'open'
    AND ci.product_id IS NOT NULL
  GROUP BY c.buyer_user_id
  LIMIT 1
)
SELECT 
  '💰 Costo calculado para primer usuario' as test,
  buyer_user_id,
  result.*
FROM user_cart,
LATERAL calculate_cart_shipping_cost_dynamic(items) result;

-- =============================================================================

-- PASO 4: Ver TODOS los usuarios con carritos y sus costos
WITH user_carts AS (
  SELECT 
    c.buyer_user_id,
    COUNT(ci.id) as items_count,
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as items
  FROM b2b_carts c
  JOIN b2b_cart_items ci ON c.id = ci.cart_id
  WHERE c.status = 'open'
    AND ci.product_id IS NOT NULL
  GROUP BY c.buyer_user_id
)
SELECT 
  '📊 Resumen de todos los usuarios' as test,
  uc.buyer_user_id,
  uc.items_count,
  csc.total_weight_kg,
  csc.weight_rounded_kg,
  csc.total_cost_with_type as costo_usd
FROM user_carts uc,
LATERAL calculate_cart_shipping_cost_dynamic(uc.items) csc
ORDER BY uc.buyer_user_id;

-- =============================================================================

-- PASO 5: Verificar si los productos tienen peso_g o peso_kg
SELECT 
  '⚖️ Productos sin peso definido' as alerta,
  p.id,
  p.nombre,
  p.peso_kg,
  p.peso_g,
  CASE 
    WHEN p.peso_kg IS NULL AND p.peso_g IS NULL THEN '❌ SIN PESO'
    WHEN p.peso_kg IS NOT NULL THEN '✅ Tiene peso_kg'
    WHEN p.peso_g IS NOT NULL THEN '✅ Tiene peso_g'
  END as estado
FROM products p
WHERE p.id IN (
  SELECT DISTINCT ci.product_id 
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
)
ORDER BY p.nombre;
