-- =============================================================================
-- VERIFICACIÓN: Precio de logística en vista v_product_shipping_costs
-- Fecha: 2026-02-12
-- =============================================================================

-- 1. Ver algunos costos de logística calculados desde la vista
SELECT 
  product_id,
  product_name,
  sku,
  weight_kg,
  is_oversize,
  base_cost as costo_base,
  oversize_surcharge as recargo_oversize,
  dimensional_surcharge as recargo_dimensional,
  total_cost as costo_total_logistica
FROM v_product_shipping_costs
LIMIT 10;

-- 2. Ver productos en seller_catalog y sus costos de logística calculados
SELECT 
  sc.id,
  sc.sku,
  sc.nombre,
  sc.precio_b2b_base as precio_compra,
  sc.costo_logistica as logistica_historico,
  vpsc.total_cost as logistica_calculado,
  sc.precio_venta,
  (sc.precio_venta - (sc.precio_b2b_base + COALESCE(vpsc.total_cost, sc.costo_logistica))) as ganancia_con_nuevo_costo
FROM seller_catalog sc
LEFT JOIN v_product_shipping_costs vpsc ON vpsc.product_id = sc.source_product_id
WHERE sc.is_active = TRUE
LIMIT 10;

-- 3. Verificar que la vista tenga datos
SELECT 
  COUNT(*) as total_productos_con_logistica,
  ROUND(AVG(total_cost), 2) as costo_promedio,
  ROUND(MIN(total_cost), 2) as costo_minimo,
  ROUND(MAX(total_cost), 2) as costo_maximo
FROM v_product_shipping_costs;

-- =============================================================================
-- Resultado Esperado:
-- - La columna "costo_total_logistica" muestra el precio completo de logística
-- - En seller_catalog, "logistica_calculado" muestra el valor actualizado
-- - El frontend debe mostrar este valor en la tabla del catálogo
-- =============================================================================
