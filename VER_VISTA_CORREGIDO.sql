-- ===========================================================================
-- VER: v_product_shipping_costs (corregido)
-- ===========================================================================

-- 1. Ver definición de v_product_shipping_costs
SELECT pg_get_viewdef('v_product_shipping_costs', true) as definicion;


-- 2. Ver columnas que tiene
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_product_shipping_costs'
ORDER BY ordinal_position;


-- 3. Ver sample de datos (primeros 5 registros)
SELECT *
FROM v_product_shipping_costs
LIMIT 5;


-- 4. Buscar por product_id (sin asumir variant_id existe)
SELECT 
  ci.product_id,
  ci.variant_id as "variant_id del carrito",
  ci.quantity,
  vpsc.*
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN v_product_shipping_costs vpsc ON vpsc.product_id = ci.product_id
WHERE c.status = 'open';
