-- ============================================================================
-- CONFIGURACIÓN DE LOGÍSTICA Y FUNCIÓN DE CÁLCULO DE COSTOS
-- Propósito: Tablas y función para soportar el motor de logística multitramo
--            con soporte para Standard vs Oversize, redondeo B2B, etc.
-- Fecha: 2026-02-06
-- ============================================================================

-- 1. TABLA: RUTAS DE ENVÍO (Segmentos de viaje con tarifas propias)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name VARCHAR(100) NOT NULL UNIQUE,
    -- Tramo A: Ej. "China-USA", Tarifa por KG
    origin_hub VARCHAR(50) NOT NULL,
    destination_hub VARCHAR(50) NOT NULL,
    cost_per_kg DECIMAL(10, 4) NOT NULL,
    -- Tramo B: Continuación del envío, Tarifa por Libra
    cost_per_lb DECIMAL(10, 4) NOT NULL,
    -- Oversize: Factor de volumen (cm³/kg). Típico: 5000 o 6000
    oversize_volume_factor INTEGER DEFAULT 5000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA: TIPOS DE ENVÍO PERMITIDOS POR RUTA
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_types_per_route (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES shipping_routes(id) ON DELETE CASCADE,
    shipping_type VARCHAR(20) NOT NULL, -- 'STANDARD', 'EXPRESS'
    is_available BOOLEAN DEFAULT TRUE,
    -- Nota: Para OVERSIZE, solo STANDARD está permitido (regla de negocio)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(route_id, shipping_type)
);

-- 3. TABLA: ZONAS DE ENVÍO (Ubicaciones de destino final)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(50) NOT NULL,
    -- El departamento/estado permite zonificación dentro de un país
    department_or_state VARCHAR(100),
    -- Recargo adicional para la entrega final (Tramo B)
    final_delivery_surcharge DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA: PRODUCTOS SENSIBLES (Para aplicar recargos especiales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensitive_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sensitivity_type VARCHAR(50) NOT NULL, -- 'FRAGILE', 'PERISHABLE', 'HAZARDOUS', etc.
    extra_charge_per_gram DECIMAL(10, 6),
    extra_charge_per_volume DECIMAL(10, 2),
    handling_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, sensitivity_type)
);

-- ============================================================================
-- FUNCIÓN: CALCULAR COSTO DE ENVÍO
-- ============================================================================
-- Entrada:
--   p_item_id: ID del producto o variante
--   p_is_variant: TRUE si es variante, FALSE si es producto
--   p_quantity: Cantidad de unidades
--   p_route_id: ID de la ruta de envío
--   p_shipping_type: 'STANDARD' o 'EXPRESS'
--   p_destination_zone_id: ID de la zona de destino (para recargos)
--
-- Salida:
--   JSON con:
--   - weight_g: Peso total en gramos
--   - weight_kg: Peso total en kilogramos
--   - weight_lb: Peso total en libras
--   - is_oversize: Si aplica lógica de oversize
--   - volumetric_weight_kg: Peso volumétrico (si aplica)
--   - chargeable_weight_kg: Peso a cobrar (mayor entre real y volumétrico)
--   - cost_tramo_a: Costo Tramo A (China-USA)
--   - cost_tramo_b: Costo Tramo B (USA-Destino)
--   - surcharge_final_delivery: Recargo de zona
--   - extra_charges_sensitive: Recargos por producto sensible
--   - total_shipping_cost: Costo total de envío
--   - error: Mensaje de error si aplica
-- ============================================================================
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
    v_route_exists BOOLEAN;
    v_zone_exists BOOLEAN;
BEGIN
    -- 1. VALIDAR ENTRADA
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('error', 'La cantidad debe ser mayor a 0');
    END IF;
    
    IF p_shipping_type NOT IN ('STANDARD', 'EXPRESS') THEN
        RETURN jsonb_build_object('error', 'Tipo de envío inválido: ' || p_shipping_type);
    END IF;
    
    -- 2. OBTENER DATOS LOGÍSTICOS DEL ITEM (producto o variante)
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
    
    -- 3. VALIDAR QUE OVERSIZE + EXPRESS NO SEAN SIMULTÁNEOS
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
    
    -- 5. CALCULAR PESO TOTAL EN MÚLTIPLES UNIDADES
    -- No redondear aquí (requisito B2B): sumar gramos, luego convertir
    v_weight_g := v_weight_kg * 1000 * p_quantity;
    v_weight_kg := v_weight_g / 1000;
    v_weight_lb := v_weight_kg * 2.20462;
    
    -- 6. LÓGICA OVERSIZE: Calcular peso volumétrico
    IF v_is_oversize = TRUE AND v_length_cm > 0 AND v_width_cm > 0 AND v_height_cm > 0 THEN
        -- Peso volumétrico = (L × A × H) / Factor
        v_volumetric_weight_kg := (v_length_cm * v_width_cm * v_height_cm) / v_oversize_factor;
        -- Cobrar el mayor entre peso real y volumétrico
        v_chargeable_weight_kg := GREATEST(v_weight_kg, v_volumetric_weight_kg);
    ELSE
        v_volumetric_weight_kg := NULL;
        v_chargeable_weight_kg := v_weight_kg;
    END IF;
    
    -- 7. REDONDEO B2B: Math.ceil() solo al total final
    -- El requisito dice: peso mínimo facturable es 1
    v_chargeable_weight_kg := GREATEST(CEIL(v_chargeable_weight_kg), 1);
    
    -- 8. CALCULAR COSTOS POR TRAMO
    v_cost_tramo_a := v_chargeable_weight_kg * v_cost_per_kg;
    v_cost_tramo_b := v_chargeable_weight_kg * 2.20462 * v_cost_per_lb; -- Convertir a libras para Tramo B
    
    -- 9. RECARGO POR ZONA FINAL DE ENTREGA
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- EJEMPLO DE USO DE LA FUNCIÓN:
-- ============================================================================
--
-- SELECT fn_calculate_shipping_cost(
--     p_item_id := 'product-uuid',
--     p_is_variant := FALSE,
--     p_quantity := 5,
--     p_route_id := 'route-uuid',
--     p_shipping_type := 'STANDARD',
--     p_destination_zone_id := 'zone-uuid'
-- );
--
-- Respuesta:
-- {
--   "success": true,
--   "weight_g": 500.00,
--   "weight_kg": 0.5000,
--   "weight_lb": 1.1023,
--   "is_oversize": false,
--   "volumetric_weight_kg": null,
--   "chargeable_weight_kg": 1.0000,
--   "cost_tramo_a": 15.50,
--   "cost_tramo_b": 8.20,
--   "surcharge_final_delivery": 5.00,
--   "extra_charges_sensitive": 0.00,
--   "total_shipping_cost": 28.70,
--   "transparency_label": "Peso Real: 500 g | Peso Facturable: 1.00 kg"
-- }
--
-- ============================================================================
