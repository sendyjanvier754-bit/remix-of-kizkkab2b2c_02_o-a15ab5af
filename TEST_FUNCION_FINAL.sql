-- ===========================================================================
-- TEST FINAL: Verificar función get_cart_shipping_cost con carrito real
-- ===========================================================================

-- 1. Construir array de items del carrito (como lo hace el frontend)
WITH cart_items_array AS (
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
  WHERE c.status = 'open'
)
SELECT 
  '📦 Array de items para función' as info,
  jsonb_pretty(items) as cart_items
FROM cart_items_array;


-- 2. Llamar a get_cart_shipping_cost con ese array
WITH cart_items_array AS (
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
  WHERE c.status = 'open'
)
SELECT 
  '💰 Resultado de get_cart_shipping_cost' as info,
  get_cart_shipping_cost(items) as resultado
FROM cart_items_array;


-- 3. Extraer campos del resultado
WITH cart_items_array AS (
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
  WHERE c.status = 'open'
),
resultado AS (
  SELECT get_cart_shipping_cost(items) as result
  FROM cart_items_array
)
SELECT 
  '✅ Costo calculado' as info,
  (result->>'total_items')::integer as total_items,
  ROUND((result->>'total_weight_kg')::numeric, 3) as peso_kg,
  (result->>'weight_rounded_kg')::numeric as peso_redondeado_kg,
  ROUND((result->>'base_cost')::numeric, 2) as costo_base_usd,
  ROUND((result->>'total_cost_with_type')::numeric, 2) as total_costo_usd,
  (result->>'shipping_type_display') as tipo_envio
FROM resultado;


-- 4. Verificar valores de weight_g en products/variants
SELECT 
  '⚖️ Pesos en DB' as info,
  ci.product_id,
  ci.variant_id,
  p.weight_g as "products.weight_g",
  pv.weight_g as "product_variants.weight_g",
  COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 as "peso_final_kg",
  ci.quantity,
  (COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 * ci.quantity) as "peso_total_item_kg"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open';


-- =============================================================================
-- DIAGNÓSTICO FINAL
-- =============================================================================

/*
RESULTADO ESPERADO:
===================

Query 3 debería mostrar:
- total_items: 4
- peso_kg: 1.200 (4 items × 0.3kg × 1 qty)
- peso_redondeado_kg: 2 (CEIL(1.2))
- costo_base_usd: $29.05 (2kg × $14.52/kg)
- total_costo_usd: $29.05

SI MUESTRA ESTO:
→ ✅ La función FUNCIONA correctamente
→ ✅ El problema es caché del frontend
→ Solución: Limpiar caché de React Query o hard refresh

SI MUESTRA peso_kg = 0:
→ ❌ products.weight_g y product_variants.weight_g = 0 o NULL
→ Solución: Ejecutar ACTUALIZAR_PESOS_VARIANTES.sql

SI MUESTRA total_costo_usd diferente a $29.05:
→ ❌ Constantes de precio incorrectas
→ Verificar tabla shipping_routes, tramo_prices

PRÓXIMO PASO:
=============
Ejecuta este SQL y muéstrame el resultado de la Query 3.
*/
