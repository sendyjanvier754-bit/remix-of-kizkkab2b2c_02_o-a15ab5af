-- ===========================================================================
-- VER DEFINICIÓN: v_product_shipping_costs
-- ===========================================================================

-- 1. Ver definición completa de v_product_shipping_costs
SELECT pg_get_viewdef('v_product_shipping_costs', true) as definicion;


-- 2. Ver columnas de v_product_shipping_costs
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_product_shipping_costs'
ORDER BY ordinal_position;


-- 3. Consultar v_product_shipping_costs para ver qué datos tiene
SELECT *
FROM v_product_shipping_costs
LIMIT 5;


-- 4. Ver si los productos del carrito están en v_product_shipping_costs
SELECT 
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  vpsc.*
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN v_product_shipping_costs vpsc ON 
  vpsc.product_id = ci.product_id 
  AND (
    (vpsc.variant_id = ci.variant_id) 
    OR (vpsc.variant_id IS NULL AND ci.variant_id IS NULL)
  )
WHERE c.status = 'open';
