-- ============================================================================
-- ACTUALIZAR PESOS DE VARIANTES SEGÚN EL NOMBRE DEL PRODUCTO
-- ============================================================================

-- 1. Actualizar todas las variantes de "Camiseta" a 600g
UPDATE product_variants pv
SET peso_g = 600
FROM products p
WHERE pv.product_id = p.id 
AND p.nombre ILIKE '%camiseta%'
AND pv.peso_g = 0;

-- 2. Actualizar todas las variantes de "Tanga" a 300g
UPDATE product_variants pv
SET peso_g = 300
FROM products p
WHERE pv.product_id = p.id 
AND p.nombre ILIKE '%tanga%'
AND pv.peso_g = 0;

-- ============================================================================
-- VERIFICACIÓN: Ver las variantes actualizadas
-- ============================================================================
SELECT 
    pv.id AS variant_id,
    p.nombre AS product_name,
    pv.name AS variant_name,
    pv.peso_g,
    pv.peso_g / 1000.0 AS peso_kg
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.peso_g > 0
ORDER BY p.nombre, pv.name;

-- ============================================================================
-- VERIFICACIÓN: Ver datos actualizados de v_logistics_data para las variantes
-- ============================================================================
SELECT 
    variant_id,
    product_id,
    item_name,
    weight_kg
FROM v_logistics_data 
WHERE variant_id IS NOT NULL AND weight_kg > 0
ORDER BY item_name;
