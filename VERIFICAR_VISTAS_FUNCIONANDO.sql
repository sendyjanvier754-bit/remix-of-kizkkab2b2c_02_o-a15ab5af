-- =============================================================================
-- VERIFICACIÓN RÁPIDA: Vistas de logística funcionando correctamente
-- Fecha: 2026-02-12
-- =============================================================================

-- 1. Ver productos con sus costos de logística calculados
SELECT 
  product_id,
  product_name,
  sku,
  weight_kg as peso_usado_kg,
  base_cost as costo_base,
  total_cost as costo_total,
  CASE 
    WHEN total_cost > 0 THEN 'OK - Tiene costo'
    WHEN weight_kg = 0 THEN 'Sin peso configurado'
    ELSE 'Revisar'
  END as estado
FROM v_product_shipping_costs
WHERE sku IN ('924221472', '2962434831', '758788899')
ORDER BY sku;

-- 2. Ver seller_catalog con logística desde la vista
SELECT 
  sc.nombre,
  sc.sku,
  vpsc.weight_kg as peso_kg,
  vpsc.total_cost as logistica_calculada,
  sc.costo_logistica as logistica_historica,
  CASE 
    WHEN vpsc.total_cost > sc.costo_logistica THEN 'Costo aumentó'
    WHEN vpsc.total_cost < sc.costo_logistica THEN 'Costo disminuyó'
    WHEN vpsc.total_cost = sc.costo_logistica THEN 'Mismo costo'
    WHEN vpsc.total_cost IS NULL THEN 'Sin datos en vista'
    ELSE 'OK'
  END as comparacion
FROM seller_catalog sc
LEFT JOIN v_product_shipping_costs vpsc 
  ON vpsc.product_id = sc.source_product_id
WHERE sc.is_active = TRUE
ORDER BY sc.nombre
LIMIT 10;

-- 3. Estadísticas generales
SELECT 
  COUNT(*) as total_productos_en_vista,
  COUNT(CASE WHEN total_cost > 0 THEN 1 END) as con_costo_logistica,
  COUNT(CASE WHEN total_cost = 0 THEN 1 END) as con_costo_cero,
  ROUND(AVG(total_cost), 2) as costo_promedio,
  ROUND(MIN(total_cost), 2) as costo_minimo,
  ROUND(MAX(total_cost), 2) as costo_maximo
FROM v_product_shipping_costs;

-- 4. Productos que pasaron de $0 a tener costo (después de la corrección)
SELECT 
  p.nombre,
  p.sku_interno,
  p.peso_kg,
  p.peso_g,
  vpsc.weight_kg as peso_usado_en_vista,
  vpsc.total_cost as nuevo_costo_logistica
FROM products p
JOIN v_product_shipping_costs vpsc ON vpsc.product_id = p.id
WHERE p.peso_g > 0 
  AND vpsc.total_cost > 0
ORDER BY p.nombre
LIMIT 10;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Query 1: Los 3 SKUs deben mostrar costo_total > 0
-- Query 2: Debe mostrar coincidencias entre seller_catalog y la vista
-- Query 3: Debe mostrar que la mayoría tienen costo > 0
-- Query 4: Debe mostrar productos con peso_g convertido correctamente
-- =============================================================================
