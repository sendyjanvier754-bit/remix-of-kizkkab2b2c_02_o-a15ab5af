-- ============================================================================
-- PASO 1: AGREGAR CAMPOS DE PESO A PRODUCT_VARIANTS
-- ============================================================================

-- Agregar columnas de peso a product_variants si no existen
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS peso_g INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight_g INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10, 4) DEFAULT 0;

-- ============================================================================
-- PASO 2: ACTUALIZAR LA VISTA V_LOGISTICS_DATA 
-- Para que use peso de variante si existe, sino peso del producto
-- ============================================================================

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
    
    -- IMPORTANTE: Primero intenta el peso de la VARIANTE, luego del PRODUCTO
    COALESCE(
        NULLIF(pv.weight_kg, 0),
        NULLIF(pv.peso_kg, 0),
        NULLIF(pv.weight_g / 1000.0, 0),
        NULLIF(pv.peso_g / 1000.0, 0),
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

-- ============================================================================
-- VERIFICACIÓN: Ver estructura de product_variants
-- ============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_variants' 
ORDER BY ordinal_position;

-- ============================================================================
-- VERIFICACIÓN: Ver datos de v_logistics_data para variantes
-- ============================================================================
SELECT variant_id, product_id, item_name, weight_kg 
FROM v_logistics_data 
WHERE variant_id IS NOT NULL 
LIMIT 10;
