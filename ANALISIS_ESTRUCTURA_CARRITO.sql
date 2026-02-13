-- =============================================================================
-- ANÁLISIS: Estructura actual de tablas de carrito
-- =============================================================================

-- 1. Ver estructura de b2b_carts
SELECT 
  '📋 ESTRUCTURA b2b_carts' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'b2b_carts'
ORDER BY ordinal_position;

-- 2. Ver estructura de b2b_cart_items
SELECT 
  '📦 ESTRUCTURA b2b_cart_items' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'b2b_cart_items'
ORDER BY ordinal_position;

-- 3. Ver cómo funciona v_product_shipping_costs
SELECT 
  '🔍 EJEMPLO v_product_shipping_costs' as info,
  product_id,
  product_name,
  variant_id,
  variant_name,
  weight_kg as peso_calculado,
  total_cost as costo_envio
FROM v_product_shipping_costs
WHERE product_id IN (
  SELECT DISTINCT product_id 
  FROM b2b_cart_items 
  WHERE cart_id = '4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7'
)
LIMIT 10;

-- 4. Ver definición de v_product_shipping_costs
SELECT 
  '📖 DEFINICIÓN VISTA' as info,
  definition
FROM pg_views
WHERE viewname = 'v_product_shipping_costs';
