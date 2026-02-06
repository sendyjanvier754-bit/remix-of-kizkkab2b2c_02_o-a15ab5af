-- ============================================================================
-- RECREAR V_LOGISTICS_DATA PARA LIMPIAR CACHE
-- ============================================================================

-- Primero eliminar la vista
DROP VIEW IF EXISTS v_logistics_data CASCADE;

-- Recrear la vista (sin cache)
CREATE VIEW v_logistics_data AS

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
-- RECREAR FUNCIÓN RPC (sin STABLE para evitar cache)
-- ============================================================================

DROP FUNCTION IF EXISTS fn_calculate_shipping_cost(uuid, boolean, integer, uuid, varchar, uuid) CASCADE;

CREATE OR REPLACE FUNCTION fn_calculate_shipping_cost(
    p_item_id UUID,
    p_is_variant BOOLEAN,
    p_quantity INTEGER,
    p_route_id UUID,
    p_shipping_type VARCHAR,
    p_destination_zone_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_weight_kg DECIMAL;
    v_length_cm DECIMAL;
    v_width_cm DECIMAL;
    v_height_cm DECIMAL;
    v_is_oversize BOOLEAN;
    v_product_id UUID;
    v_volumetric_weight_kg DECIMAL;
    v_chargeable_weight_kg DECIMAL;
    v_weight_g DECIMAL;
    v_weight_lb DECIMAL;
    v_cost_per_kg DECIMAL;
    v_cost_per_lb DECIMAL;
    v_oversize_factor INTEGER;
    v_cost_tramo_a DECIMAL;
    v_cost_tramo_b DECIMAL;
    v_surcharge_final_delivery DECIMAL;
    v_extra_charges DECIMAL;
BEGIN
    -- 1. VALIDAR ENTRADA
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('error', 'La cantidad debe ser mayor a 0');
    END IF;
    
    IF p_shipping_type NOT IN ('STANDARD', 'EXPRESS') THEN
        RETURN jsonb_build_object('error', 'Tipo de envío inválido: ' || p_shipping_type);
    END IF;
    
    -- 2. OBTENER DATOS LOGÍSTICOS DEL ITEM
    SELECT 
        weight_kg, length_cm, width_cm, height_cm, is_oversize, product_id
    INTO 
        v_weight_kg, v_length_cm, v_width_cm, v_height_cm, v_is_oversize, v_product_id
    FROM v_logistics_data
    WHERE (
        (p_is_variant = TRUE AND variant_id = p_item_id) OR
        (p_is_variant = FALSE AND product_id = p_item_id AND variant_id IS NULL)
    );
    
    IF v_weight_kg IS NULL THEN
        RETURN jsonb_build_object('error', 'Producto/variante no encontrado o sin peso');
    END IF;
    
    -- 3. VALIDAR OVERSIZE + EXPRESS
    IF v_is_oversize = TRUE AND p_shipping_type = 'EXPRESS' THEN
        RETURN jsonb_build_object('error', 'Productos OVERSIZE solo permiten envío STANDARD');
    END IF;
    
    -- 4. OBTENER TARIFAS DE RUTA
    SELECT cost_per_kg, cost_per_lb, oversize_volume_factor
    INTO v_cost_per_kg, v_cost_per_lb, v_oversize_factor
    FROM shipping_routes
    WHERE id = p_route_id AND is_active = TRUE;
    
    IF v_cost_per_kg IS NULL THEN
        RETURN jsonb_build_object('error', 'Ruta de envío no encontrada o inactiva');
    END IF;
    
    -- 5. CALCULAR PESO TOTAL
    v_weight_g := v_weight_kg * 1000 * p_quantity;
    v_weight_kg := v_weight_g / 1000;
    v_weight_lb := v_weight_kg * 2.20462;
    
    -- 6. LÓGICA OVERSIZE
    IF v_is_oversize = TRUE AND v_length_cm > 0 AND v_width_cm > 0 AND v_height_cm > 0 THEN
        v_volumetric_weight_kg := (v_length_cm * v_width_cm * v_height_cm) / v_oversize_factor;
        v_chargeable_weight_kg := GREATEST(v_weight_kg, v_volumetric_weight_kg);
    ELSE
        v_volumetric_weight_kg := NULL;
        v_chargeable_weight_kg := v_weight_kg;
    END IF;
    
    -- 7. REDONDEO B2B
    v_chargeable_weight_kg := GREATEST(CEIL(v_chargeable_weight_kg), 1);
    
    -- 8. CALCULAR COSTOS POR TRAMO
    v_cost_tramo_a := v_chargeable_weight_kg * v_cost_per_kg;
    v_cost_tramo_b := v_chargeable_weight_kg * 2.20462 * v_cost_per_lb;
    
    -- 9. RECARGO POR ZONA
    v_surcharge_final_delivery := 0;
    IF p_destination_zone_id IS NOT NULL THEN
        SELECT final_delivery_surcharge
        INTO v_surcharge_final_delivery
        FROM shipping_zones
        WHERE id = p_destination_zone_id AND is_active = TRUE;
        
        IF v_surcharge_final_delivery IS NULL THEN
            v_surcharge_final_delivery := 0;
        END IF;
    END IF;
    
    -- 10. RECARGOS POR PRODUCTO SENSIBLE
    v_extra_charges := 0;
    SELECT COALESCE(SUM(
        COALESCE(extra_charge_per_gram * v_weight_g, 0) +
        COALESCE(extra_charge_per_volume * (v_length_cm * v_width_cm * v_height_cm / 1000), 0)
    ), 0)
    INTO v_extra_charges
    FROM sensitive_products
    WHERE product_id = v_product_id AND is_active = TRUE;
    
    -- 11. CONSTRUIR RESPUESTA
    v_result := jsonb_build_object(
        'success', TRUE,
        'weight_g', ROUND(v_weight_g, 2),
        'weight_kg', ROUND(v_weight_kg, 4),
        'weight_lb', ROUND(v_weight_lb, 4),
        'is_oversize', v_is_oversize,
        'volumetric_weight_kg', CASE WHEN v_volumetric_weight_kg IS NOT NULL THEN ROUND(v_volumetric_weight_kg, 4) ELSE NULL END,
        'chargeable_weight_kg', ROUND(v_chargeable_weight_kg, 4),
        'cost_tramo_a', ROUND(v_cost_tramo_a, 2),
        'cost_tramo_b', ROUND(v_cost_tramo_b, 2),
        'surcharge_final_delivery', ROUND(v_surcharge_final_delivery, 2),
        'extra_charges_sensitive', ROUND(v_extra_charges, 2),
        'total_shipping_cost', ROUND(v_cost_tramo_a + v_cost_tramo_b + v_surcharge_final_delivery + v_extra_charges, 2),
        'transparency_label', 'Peso Real: ' || ROUND(v_weight_g, 0) || ' g | Peso Facturable: ' || ROUND(v_chargeable_weight_kg, 2) || ' kg'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'Error al calcular costo: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 
    variant_id,
    product_id,
    item_name,
    weight_kg
FROM v_logistics_data 
WHERE variant_id IS NOT NULL AND weight_kg > 0
ORDER BY item_name;
