-- ===========================================================================
-- VERIFICAR: v_product_shipping_costs - ¿De dónde obtiene los pesos?
-- ===========================================================================

-- 1. Ver definición completa de v_product_shipping_costs
SELECT 
  '📋 Definición v_product_shipping_costs' as info,
  pg_get_viewdef('v_product_shipping_costs', true) as definicion;


-- 2. Ver estructura (columnas) de v_product_shipping_costs
SELECT 
  '📊 Columnas de v_product_shipping_costs' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_product_shipping_costs'
ORDER BY ordinal_position;


-- 3. Consultar v_product_shipping_costs para productos del carrito
SELECT 
  '📦 Pesos desde v_product_shipping_costs' as info,
  vpsc.product_id,
  vpsc.variant_id,
  vpsc.*
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN v_product_shipping_costs vpsc ON 
  vpsc.product_id = ci.product_id 
  AND (vpsc.variant_id = ci.variant_id OR (vpsc.variant_id IS NULL AND ci.variant_id IS NULL))
WHERE c.status = 'open';


-- 4. Consultar TODOS los registros de v_product_shipping_costs (sample)
SELECT 
  '📊 Sample de v_product_shipping_costs (primeros 10)' as info,
  *
FROM v_product_shipping_costs
LIMIT 10;


-- 5. Ver si los productos del carrito ESTÁN en v_product_shipping_costs
SELECT 
  '✅ ¿Productos del carrito en v_product_shipping_costs?' as info,
  ci.product_id,
  ci.variant_id,
  CASE 
    WHEN vpsc.product_id IS NOT NULL THEN '✅ SÍ'
    ELSE '❌ NO'
  END as existe_en_vista
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN v_product_shipping_costs vpsc ON 
  vpsc.product_id = ci.product_id 
  AND (vpsc.variant_id = ci.variant_id OR (vpsc.variant_id IS NULL AND ci.variant_id IS NULL))
WHERE c.status = 'open';


-- 6. Comparar: pesos en products/variants vs v_product_shipping_costs
WITH cart_products AS (
  SELECT DISTINCT
    ci.product_id,
    ci.variant_id
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
)
SELECT 
  '⚖️ Comparación de pesos' as info,
  cp.product_id,
  cp.variant_id,
  p.weight_g as "DB: Producto (g)",
  pv.weight_g as "DB: Variante (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) as "DB: Final (g)",
  '---' as separador
  -- vpsc columns to be determined after seeing structure
FROM cart_products cp
LEFT JOIN products p ON cp.product_id = p.id
LEFT JOIN product_variants pv ON cp.variant_id = pv.id
LEFT JOIN v_product_shipping_costs vpsc ON 
  vpsc.product_id = cp.product_id 
  AND (vpsc.variant_id = cp.variant_id OR (vpsc.variant_id IS NULL AND cp.variant_id IS NULL));


-- =============================================================================
-- ANÁLISIS
-- =============================================================================

/*
OBJETIVO:
=========
Encontrar:
1. ¿Qué columnas tiene v_product_shipping_costs?
2. ¿De dónde obtiene los pesos (weight_g, weight_kg)?
3. ¿Los productos del carrito ESTÁN en esta vista?
4. ¿Los pesos son correctos o 0?

POSIBLES PROBLEMAS:
===================
A. Vista no incluye los productos del carrito
   → Hay filtro que los excluye
   → Solución: Modificar vista o agregar productos

B. Vista retorna peso = 0
   → Consulta columna incorrecta
   → Solución: Corregir SELECT de la vista

C. Vista usa otra fuente de datos
   → No lee de products.weight_g
   → Solución: Actualizar vista para leer correctamente

PRÓXIMOS PASOS:
===============
1. Ejecutar Query 1: Ver definición de v_product_shipping_costs
2. Ejecutar Query 2: Ver columnas disponibles
3. Ejecutar Query 3: Ver si retorna datos para productos del carrito
4. Ejecutar Query 5: Verificar si productos están en la vista

Si productos NO están en la vista:
→ Necesitamos agregarlos o corregir filtros

Si productos SÍ están pero peso = 0:
→ Necesitamos corregir la definición de la vista
*/
