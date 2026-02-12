-- =============================================================================
-- DIAGNÓSTICO: ¿Por qué la columna Logística muestra $0.00?
-- Fecha: 2026-02-12
-- =============================================================================

-- 1. Verificar si la vista v_product_shipping_costs existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'v_product_shipping_costs';

-- 2. Verificar si la vista tiene datos
SELECT 
  COUNT(*) as total_productos,
  COUNT(CASE WHEN total_cost > 0 THEN 1 END) as con_costo_logistica,
  COUNT(CASE WHEN total_cost = 0 THEN 1 END) as sin_costo_logistica,
  ROUND(AVG(total_cost), 2) as costo_promedio
FROM v_product_shipping_costs;

-- 3. Ver algunos productos de la vista con sus costos
SELECT 
  product_id,
  product_name,
  sku,
  weight_kg,
  is_oversize,
  base_cost,
  total_cost
FROM v_product_shipping_costs
LIMIT 10;

-- 4. Verificar productos en seller_catalog y si tienen source_product_id
SELECT 
  sc.id,
  sc.sku,
  sc.nombre,
  sc.source_product_id,
  sc.precio_b2b_base,
  sc.costo_logistica as logistica_historica,
  sc.is_active
FROM seller_catalog sc
WHERE sc.is_active = TRUE
LIMIT 10;

-- 5. CRÍTICO: Ver si hay coincidencias entre seller_catalog y la vista
SELECT 
  sc.id as seller_catalog_id,
  sc.sku,
  sc.nombre,
  sc.source_product_id,
  sc.costo_logistica as logistica_historica,
  vpsc.product_id as vista_product_id,
  vpsc.weight_kg as peso_vista,
  vpsc.total_cost as logistica_calculada,
  CASE 
    WHEN vpsc.product_id IS NULL THEN '❌ No hay match en vista'
    WHEN vpsc.total_cost = 0 THEN '⚠️ Costo = 0'
    ELSE '✅ OK'
  END as estado
FROM seller_catalog sc
LEFT JOIN v_product_shipping_costs vpsc 
  ON vpsc.product_id = sc.source_product_id
WHERE sc.is_active = TRUE
LIMIT 10;

-- 6. Ver productos sin peso configurado (causa de logística = 0)
SELECT 
  p.id,
  p.nombre,
  p.sku_interno,
  p.weight_kg,
  p.peso_kg,
  p.weight_g,
  p.peso_g,
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as peso_final,
  p.is_active
FROM products p
WHERE p.id IN (
  SELECT DISTINCT source_product_id 
  FROM seller_catalog 
  WHERE source_product_id IS NOT NULL
)
AND COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) = 0
LIMIT 10;

-- 7. SOLUCIÓN: Si los productos no tienen peso, actualizarlos
-- DESCOMENTAR Y EJECUTAR SI ES NECESARIO:
/*
-- Ejemplo: Asignar peso a productos que no lo tienen
UPDATE products 
SET weight_kg = 0.5  -- 500 gramos por defecto
WHERE id IN (
  SELECT DISTINCT source_product_id 
  FROM seller_catalog 
  WHERE source_product_id IS NOT NULL
)
AND COALESCE(weight_kg, peso_kg, weight_g / 1000.0, peso_g / 1000.0, 0) = 0
AND is_active = TRUE;
*/

-- =============================================================================
-- RESULTADOS ESPERADOS:
-- Paso 5 es el más importante: debe mostrar si hay coincidencias entre 
-- seller_catalog.source_product_id y v_product_shipping_costs.product_id
-- =============================================================================
