-- Fix v_logistics_data view to ignore weight values of 0
CREATE OR REPLACE VIEW v_logistics_data AS

SELECT
    p.id AS product_id,
    NULL::uuid AS variant_id,
    'PRODUCT' AS item_type,
    p.nombre AS item_name,
    p.sku_interno AS sku,
    
    COALESCE(
        NULLIF(p.weight_kg, 0),
        NULLIF(p.peso_kg, 0),
        NULLIF(p.weight_g / 1000.0, 0),
        NULLIF(p.peso_g / 1000.0, 0),
        0
    ) AS weight_kg,
    
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

SELECT
    pv.product_id,
    pv.id AS variant_id,
    'VARIANT' AS item_type,
    p.nombre || ' - ' || pv.name AS item_name,
    pv.sku,
    
    COALESCE(
        NULLIF(p.weight_kg, 0),
        NULLIF(p.peso_kg, 0),
        NULLIF(p.weight_g / 1000.0, 0),
        NULLIF(p.peso_g / 1000.0, 0),
        0
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
