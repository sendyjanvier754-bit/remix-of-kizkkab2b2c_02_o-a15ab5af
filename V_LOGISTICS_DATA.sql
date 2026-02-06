-- ============================================================================
-- VISTA UNIFICADA DE DATOS LOGÍSTICOS (V_LOGISTICS_DATA)
-- Propósito: Unificar y estandarizar el acceso a datos de peso y dimensiones
--            para productos y variantes.
-- Fecha: 2026-02-06
-- ============================================================================

CREATE OR REPLACE VIEW v_logistics_data AS

-- 1. DATOS PARA PRODUCTOS QUE NO TIENEN VARIANTES (o se venden como unidad base)
SELECT
    p.id AS product_id,
    NULL::uuid AS variant_id,
    'PRODUCT' AS item_type,
    p.nombre AS item_name,
    p.sku_interno AS sku,
    
    -- Estandarización de peso a KG. Prioridad: weight_kg > peso_kg > weight_g > peso_g
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0
    ) AS weight_kg,
    
    -- Dimensiones en CM
    p.length_cm,
    p.width_cm,
    p.height_cm,
    
    p.is_oversize,
    p.is_active
FROM
    products p
WHERE 
    p.is_active = TRUE

UNION ALL

-- 2. DATOS PARA VARIANTES DE PRODUCTO
SELECT
    pv.product_id,
    pv.id AS variant_id,
    'VARIANT' AS item_type,
    p.nombre || ' - ' || pv.name AS item_name,
    pv.sku,
    
    -- Las variantes heredan el peso y dimensiones del producto padre
    COALESCE(
        p.weight_kg,
        p.peso_kg,
        p.weight_g / 1000.0,
        p.peso_g / 1000.0
    ) AS weight_kg,
    
    p.length_cm,
    p.width_cm,
    p.height_cm,
    
    p.is_oversize,
    pv.is_active
FROM
    product_variants pv
JOIN
    products p ON pv.product_id = p.id
WHERE
    pv.is_active = TRUE;

-- ============================================================================
-- MODO DE USO:
-- Esta vista se puede consultar para obtener el peso y dimensiones de cualquier
-- item vendible, ya sea un producto base o una variante.
--
-- Ejemplo 1: Obtener datos de un producto específico
-- SELECT * FROM v_logistics_data WHERE product_id = 'tu-product-id' AND variant_id IS NULL;
--
-- Ejemplo 2: Obtener datos de una variante específica
-- SELECT * FROM v_logistics_data WHERE variant_id = 'tu-variant-id';
-- ============================================================================
