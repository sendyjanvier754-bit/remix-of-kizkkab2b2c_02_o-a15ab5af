-- ============================================================================
-- SETUP COMPLETO: LOGÍSTICA (VISTA + TABLAS + FUNCIÓN + DATOS)
-- Ejecutar TODO esto en orden en Supabase SQL Editor
-- Fecha: 2026-02-06
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR VISTA V_LOGISTICS_DATA
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

-- ============================================================================
-- PASO 2: CREAR TABLAS DE LOGÍSTICA
-- ============================================================================

-- Primero eliminar tablas dependientes en orden inverso
DROP TABLE IF EXISTS shipping_types_per_route CASCADE;
DROP TABLE IF EXISTS sensitive_products CASCADE;
DROP TABLE IF EXISTS shipping_zones CASCADE;
DROP TABLE IF EXISTS shipping_routes CASCADE;

-- Ahora crear las tablas
CREATE TABLE IF NOT EXISTS shipping_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name VARCHAR(100) NOT NULL UNIQUE,
    origin_hub VARCHAR(50) NOT NULL,
    destination_hub VARCHAR(50) NOT NULL,
    cost_per_kg DECIMAL(10, 4) NOT NULL,
    cost_per_lb DECIMAL(10, 4) NOT NULL,
    oversize_volume_factor INTEGER DEFAULT 5000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_types_per_route (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES shipping_routes(id) ON DELETE CASCADE,
    shipping_type VARCHAR(20) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(route_id, shipping_type)
);

CREATE TABLE IF NOT EXISTS shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(50) NOT NULL,
    department_or_state VARCHAR(100),
    final_delivery_surcharge DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensitive_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sensitivity_type VARCHAR(50) NOT NULL,
    extra_charge_per_gram DECIMAL(10, 6),
    extra_charge_per_volume DECIMAL(10, 2),
    handling_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, sensitivity_type)
);

-- ============================================================================
-- PASO 3: CREAR FUNCIÓN fn_calculate_shipping_cost
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PASO 4: INSERTAR DATOS DE PRUEBA
-- ============================================================================

-- Insertar rutas
INSERT INTO shipping_routes (route_name, origin_hub, destination_hub, cost_per_kg, cost_per_lb, oversize_volume_factor, is_active)
VALUES
    ('CHINA-USA', 'CHINA_HUB', 'USA_HUB', 3.50, 1.80, 5000, TRUE),
    ('USA-HAITI', 'USA_HUB', 'HAITI_MAIN', 5.00, 2.50, 5000, TRUE),
    ('CHINA-USA-EXPRESS', 'CHINA_HUB', 'USA_HUB', 5.50, 2.80, 5000, TRUE);

-- Insertar tipos de envío por ruta
INSERT INTO shipping_types_per_route (route_id, shipping_type, is_available)
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA'
UNION ALL
SELECT id, 'EXPRESS', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA'
UNION ALL
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'USA-HAITI'
UNION ALL
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA-EXPRESS';

-- Insertar zonas
INSERT INTO shipping_zones (zone_name, country, department_or_state, final_delivery_surcharge, is_active)
VALUES
    ('HAITI_CENTRO', 'HAITI', 'OUEST', 5.00, TRUE),
    ('HAITI_NORTE', 'HAITI', 'NORD', 7.50, TRUE),
    ('HAITI_SUR', 'HAITI', 'SUD', 6.50, TRUE),
    ('USA_CONTIGUOUS', 'USA', NULL, 0.00, TRUE),
    ('USA_ALASKA', 'USA', 'ALASKA', 15.00, TRUE),
    ('USA_HAWAII', 'USA', 'HAWAII', 20.00, TRUE);

-- ============================================================================
-- VERIFICACIÓN: Consultar datos insertados
-- ============================================================================
SELECT 'Routes' as table_name, COUNT(*) as count FROM shipping_routes
UNION ALL
SELECT 'Zones', COUNT(*) FROM shipping_zones
UNION ALL
SELECT 'Shipping Types', COUNT(*) FROM shipping_types_per_route;
