-- ============================================================================
-- ACTUALIZAR FUNCIÓN RPC: RECIBIR WEIGHT_KG COMO PARÁMETRO
-- ============================================================================

DROP FUNCTION IF EXISTS fn_calculate_shipping_cost(uuid, boolean, integer, uuid, varchar, uuid) CASCADE;

CREATE OR REPLACE FUNCTION fn_calculate_shipping_cost(
    p_item_id UUID,
    p_is_variant BOOLEAN,
    p_quantity INTEGER,
    p_weight_kg DECIMAL,
    p_route_id UUID,
    p_shipping_type VARCHAR,
    p_destination_zone_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_weight_kg DECIMAL;
    v_chargeable_weight_kg DECIMAL;
    v_weight_g DECIMAL;
    v_weight_lb DECIMAL;
    v_cost_per_kg DECIMAL;
    v_cost_per_lb DECIMAL;
    v_volumetric_weight_kg DECIMAL;
    v_cost_tramo_a DECIMAL;
    v_cost_tramo_b DECIMAL;
    v_surcharge_final_delivery DECIMAL;
    v_extra_charges DECIMAL;
BEGIN
    -- 1. VALIDAR ENTRADA
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('error', 'La cantidad debe ser mayor a 0');
    END IF;
    
    IF p_weight_kg IS NULL OR p_weight_kg < 0 THEN
        RETURN jsonb_build_object('error', 'Peso inválido: ' || COALESCE(p_weight_kg::text, 'NULL'));
    END IF;
    
    IF p_shipping_type NOT IN ('STANDARD', 'EXPRESS') THEN
        RETURN jsonb_build_object('error', 'Tipo de envío inválido: ' || p_shipping_type);
    END IF;
    
    -- 2. USAR EL PESO PROPORCIONADO
    v_weight_kg := p_weight_kg;
    
    -- 3. OBTENER TARIFAS DE RUTA
    SELECT cost_per_kg, cost_per_lb
    INTO v_cost_per_kg, v_cost_per_lb
    FROM shipping_routes
    WHERE id = p_route_id AND is_active = TRUE;
    
    IF v_cost_per_kg IS NULL THEN
        RETURN jsonb_build_object('error', 'Ruta de envío no encontrada o inactiva');
    END IF;
    
    -- 4. CALCULAR PESO TOTAL
    v_weight_g := v_weight_kg * 1000 * p_quantity;
    v_weight_kg := v_weight_g / 1000;
    v_weight_lb := v_weight_kg * 2.20462;
    
    -- 5. REDONDEO B2B: peso facturable es el techo en kg
    v_chargeable_weight_kg := GREATEST(CEIL(v_weight_kg), 1);
    
    -- 6. CALCULAR COSTOS POR TRAMO
    v_cost_tramo_a := v_chargeable_weight_kg * v_cost_per_kg;
    v_cost_tramo_b := v_chargeable_weight_kg * 2.20462 * v_cost_per_lb;
    
    -- 7. RECARGO POR ZONA
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
    
    -- 8. CONSTRUIR RESPUESTA
    v_result := jsonb_build_object(
        'success', TRUE,
        'weight_g', ROUND(v_weight_g, 2),
        'weight_kg', ROUND(v_weight_kg, 4),
        'weight_lb', ROUND(v_weight_lb, 4),
        'chargeable_weight_kg', ROUND(v_chargeable_weight_kg, 4),
        'cost_tramo_a', ROUND(v_cost_tramo_a, 2),
        'cost_tramo_b', ROUND(v_cost_tramo_b, 2),
        'surcharge_final_delivery', ROUND(v_surcharge_final_delivery, 2),
        'total_shipping_cost', ROUND(v_cost_tramo_a + v_cost_tramo_b + v_surcharge_final_delivery, 2),
        'transparency_label', 'Peso Real: ' || ROUND(v_weight_g, 0) || ' g | Peso Facturable: ' || ROUND(v_chargeable_weight_kg, 2) || ' kg'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'Error al calcular costo: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql VOLATILE;
