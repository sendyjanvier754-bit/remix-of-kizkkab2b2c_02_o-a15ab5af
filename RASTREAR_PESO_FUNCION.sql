-- ===========================================================================
-- RASTREAR: ¿De dónde la función obtiene el peso de los productos?
-- ===========================================================================

-- PASO 1: Ver definición de la función calculate_cart_shipping_cost_dynamic
SELECT 
  '⚙️ Definición función calculate_cart_shipping_cost_dynamic' as info,
  pg_get_functiondef('calculate_cart_shipping_cost_dynamic'::regproc) as definicion;


-- PASO 2: Ver definición de get_cart_shipping_cost
SELECT 
  '⚙️ Definición función get_cart_shipping_cost' as info,
  pg_get_functiondef('get_cart_shipping_cost'::regproc) as definicion;


-- PASO 3: Consultar directamente v_logistics_data (la vista que usa la función)
-- Ver qué pesos tiene para los productos del carrito
SELECT 
  '📊 Pesos desde v_logistics_data' as info,
  vld.product_id,
  vld.variant_id,
  vld.product_weight_kg as "Peso Producto (kg)",
  vld.variant_weight_kg as "Peso Variante (kg)",
  COALESCE(vld.variant_weight_kg, vld.product_weight_kg, 0) as "Peso Final (kg)",
  vld.shipping_cost_usd as "Costo Envío (USD)"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN v_logistics_data vld ON 
  vld.product_id = ci.product_id 
  AND (vld.variant_id = ci.variant_id OR (vld.variant_id IS NULL AND ci.variant_id IS NULL))
WHERE c.status = 'open';


-- PASO 4: Si v_logistics_data no existe, consultar products/variants directamente
SELECT 
  '📦 Pesos desde products/product_variants' as info,
  ci.product_id,
  ci.variant_id,
  p.weight_g as "Peso Producto (g)",
  pv.weight_g as "Peso Variante (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) as "Peso Final (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 as "Peso Final (kg)"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open';


-- PASO 5: Ver si hay otra vista/tabla de la que se consulta el peso
-- Buscar en todas las vistas que contengan "logistics" o "weight"
SELECT 
  '🔍 Vistas relacionadas con logistics/weight' as info,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND (
    viewname LIKE '%logistics%' 
    OR viewname LIKE '%weight%'
    OR viewname LIKE '%shipping%'
  )
ORDER BY viewname;


-- PASO 6: Verificar la función calculate_shipping_cost_cart (base)
-- Esta es la que calcula el costo final
SELECT 
  '⚙️ Definición calculate_shipping_cost_cart' as info,
  pg_get_functiondef('calculate_shipping_cost_cart'::regproc) as definicion;


-- =============================================================================
-- ANÁLISIS
-- =============================================================================

/*
OBJETIVO:
=========
Encontrar exactamente de dónde la función get_cart_shipping_cost() 
obtiene el peso (weight_g o weight_kg) de los productos.

POSIBLES FUENTES:
=================
1. v_logistics_data (vista unificada)
2. products.weight_g / product_variants.weight_g (directo)
3. Otra vista intermedia
4. Cálculo hardcoded en la función

PASOS:
======
1. Ver definición de calculate_cart_shipping_cost_dynamic
   → Buscar FROM, JOIN con products/variants
   → Ver si usa v_logistics_data

2. Ver definición de v_logistics_data
   → Ver cómo calcula product_weight_kg y variant_weight_kg

3. Consultar v_logistics_data para los productos del carrito
   → Ver si retorna peso correcto o 0

4. Si v_logistics_data retorna 0, el problema está en esa vista
   → Necesitamos actualizar o corregir v_logistics_data

RESULTADO ESPERADO:
===================
Encontrar que v_logistics_data o la función está leyendo de una 
columna incorrecta, o que hay un filtro que excluye los productos.
*/
