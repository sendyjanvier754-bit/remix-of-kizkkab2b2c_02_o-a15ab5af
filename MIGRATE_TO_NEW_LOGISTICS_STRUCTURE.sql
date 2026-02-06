-- ============================================================================
-- MIGRACIÓN: NUEVA ESTRUCTURA DE LOGÍSTICA GLOBAL
-- Pasar del sistema antiguo al nuevo sistema unificado
-- ============================================================================

-- ============================================================================
-- PASO 1: ELIMINAR TABLAS ANTIGUAS Y CREAR NUEVAS
-- ============================================================================

-- Eliminar tablas en orden de dependencias
DROP TABLE IF EXISTS shipping_tiers CASCADE;
DROP TABLE IF EXISTS route_logistics_costs CASCADE;
DROP TABLE IF EXISTS shipping_routes CASCADE;
DROP TABLE IF EXISTS destination_countries CASCADE;
DROP TABLE IF EXISTS transit_hubs CASCADE;

-- Ahora crear las nuevas tablas
CREATE TABLE transit_hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE destination_countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nueva estructura de shipping_routes
CREATE TABLE shipping_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_country_id UUID REFERENCES destination_countries(id) ON DELETE CASCADE,
    transit_hub_id UUID REFERENCES transit_hubs(id) ON DELETE SET NULL,
    is_direct BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de costos por tramo
CREATE TABLE route_logistics_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_route_id UUID NOT NULL REFERENCES shipping_routes(id) ON DELETE CASCADE,
    segment VARCHAR(50) NOT NULL,
    cost_per_kg DECIMAL(10, 4) NOT NULL,
    estimated_days_min INTEGER DEFAULT 7,
    estimated_days_max INTEGER DEFAULT 21,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tipos de envío
CREATE TABLE shipping_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_route_id UUID NOT NULL REFERENCES shipping_routes(id) ON DELETE CASCADE,
    tier_type VARCHAR(20) NOT NULL,
    tier_name VARCHAR(100) NOT NULL,
    transport_type VARCHAR(20) NOT NULL,
    tramo_a_cost_per_kg DECIMAL(10, 4) NOT NULL,
    tramo_a_eta_min INTEGER DEFAULT 7,
    tramo_a_eta_max INTEGER DEFAULT 14,
    tramo_b_cost_per_lb DECIMAL(10, 4) NOT NULL,
    tramo_b_eta_min INTEGER DEFAULT 3,
    tramo_b_eta_max INTEGER DEFAULT 7,
    allows_oversize BOOLEAN DEFAULT TRUE,
    allows_sensitive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    priority_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PASO 2: INSERTAR DATOS BASE
-- ============================================================================

-- TRANSIT HUBS
INSERT INTO transit_hubs (name, code, description, is_active)
VALUES 
    ('China Hub', 'CHINA_HUB', 'Centro de distribución en China', TRUE),
    ('USA Hub', 'USA_HUB', 'Centro de distribución en USA', TRUE);

-- DESTINATION COUNTRIES
INSERT INTO destination_countries (name, code, currency, is_active)
VALUES 
    ('Haiti', 'HT', 'HTG', TRUE),
    ('Jamaica', 'JM', 'JMD', TRUE),
    ('Dominican Republic', 'DO', 'DOP', TRUE),
    ('United States', 'US', 'USD', TRUE);

-- ============================================================================
-- PASO 3: CREAR RUTAS
-- ============================================================================

-- Obtener IDs y guardar en variables CTE
WITH route_ids AS (
    INSERT INTO shipping_routes (destination_country_id, transit_hub_id, is_direct, is_active)
    SELECT 
        dc.id,
        th.id,
        FALSE,
        TRUE
    FROM destination_countries dc, transit_hubs th
    WHERE dc.code = 'HT' AND th.code = 'CHINA_HUB'
    RETURNING id
)
-- Insertar costos por tramo para la ruta creada
INSERT INTO route_logistics_costs (shipping_route_id, segment, cost_per_kg, estimated_days_min, estimated_days_max, notes, is_active)
SELECT 
    r.id,
    v_segments.segment,
    v_segments.cost_per_kg,
    v_segments.estimated_days_min,
    v_segments.estimated_days_max,
    v_segments.notes,
    TRUE
FROM route_ids r
CROSS JOIN (
    VALUES 
        ('china_to_transit'::VARCHAR, 3.50::DECIMAL, 7::INTEGER, 14::INTEGER, 'Tramo Origen → Hub'::VARCHAR),
        ('transit_to_destination'::VARCHAR, 5.00::DECIMAL, 3::INTEGER, 7::INTEGER, 'Tramo Hub → Destino'::VARCHAR)
) AS v_segments(segment, cost_per_kg, estimated_days_min, estimated_days_max, notes);

-- ============================================================================
-- PASO 4: CREAR TIPOS DE ENVÍO (TIERS)
-- ============================================================================

INSERT INTO shipping_tiers (shipping_route_id, tier_type, tier_name, transport_type, tramo_a_cost_per_kg, tramo_a_eta_min, tramo_a_eta_max, tramo_b_cost_per_lb, tramo_b_eta_min, tramo_b_eta_max, allows_oversize, allows_sensitive, is_active, priority_order)
SELECT 
    sr.id,
    v_tiers.tier_type,
    v_tiers.tier_name,
    v_tiers.transport_type,
    v_tiers.tramo_a_cost_per_kg,
    v_tiers.tramo_a_eta_min,
    v_tiers.tramo_a_eta_max,
    v_tiers.tramo_b_cost_per_lb,
    v_tiers.tramo_b_eta_min,
    v_tiers.tramo_b_eta_max,
    v_tiers.allows_oversize,
    v_tiers.allows_sensitive,
    TRUE,
    v_tiers.priority_order
FROM shipping_routes sr
CROSS JOIN (
    VALUES 
        ('STANDARD'::VARCHAR, 'Envío Estándar'::VARCHAR, 'maritimo'::VARCHAR, 3.50::DECIMAL, 7::INTEGER, 14::INTEGER, 1.80::DECIMAL, 7::INTEGER, 14::INTEGER, TRUE::BOOLEAN, FALSE::BOOLEAN, 1::INTEGER),
        ('EXPRESS'::VARCHAR, 'Envío Exprés'::VARCHAR, 'aereo'::VARCHAR, 5.50::DECIMAL, 3::INTEGER, 7::INTEGER, 2.80::DECIMAL, 2::INTEGER, 4::INTEGER, FALSE::BOOLEAN, TRUE::BOOLEAN, 2::INTEGER)
) AS v_tiers(tier_type, tier_name, transport_type, tramo_a_cost_per_kg, tramo_a_eta_min, tramo_a_eta_max, tramo_b_cost_per_lb, tramo_b_eta_min, tramo_b_eta_max, allows_oversize, allows_sensitive, priority_order)
WHERE sr.destination_country_id = (SELECT id FROM destination_countries WHERE code = 'HT')
AND sr.transit_hub_id = (SELECT id FROM transit_hubs WHERE code = 'CHINA_HUB');

-- ============================================================================
-- PASO 5: CREAR TABLAS DE ZONAS Y SURCHARGES
-- ============================================================================

-- Eliminar tabla de zonas si existe para recrearla limpia
DROP TABLE IF EXISTS shipping_zones CASCADE;

-- Crear tabla de zonas
CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(50) NOT NULL,
    department_or_state VARCHAR(100),
    final_delivery_surcharge DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar zonas de Haiti
INSERT INTO shipping_zones (zone_name, country, department_or_state, final_delivery_surcharge, is_active)
VALUES
    ('HAITI_CENTRO', 'HAITI', 'OUEST', 5.00, TRUE),
    ('HAITI_NORTE', 'HAITI', 'NORD', 7.50, TRUE),
    ('HAITI_SUR', 'HAITI', 'SUD', 6.50, TRUE);

-- ============================================================================
-- PASO 6: ACTUALIZAR FUNCIÓN RPC si es necesario
-- ============================================================================

-- La función ya debería estar actualizada desde FIX_RPC_WEIGHT_PARAM.sql
-- Pero verificamos que busque en shipping_routes correctamente:

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
    v_cost_tramo_a DECIMAL;
    v_cost_tramo_b DECIMAL;
    v_surcharge_final_delivery DECIMAL;
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
    
    -- 3. OBTENER TARIFAS: Buscar en shipping_tiers primero, luego en route_logistics_costs
    -- Intentamos obtener del tier si existe
    SELECT st.tramo_a_cost_per_kg, st.tramo_b_cost_per_lb
    INTO v_cost_per_kg, v_cost_per_lb
    FROM shipping_tiers st
    WHERE st.shipping_route_id = p_route_id 
    AND st.tier_type = p_shipping_type
    AND st.is_active = TRUE
    LIMIT 1;
    
    -- Si no existe en tier, obtener de route_logistics_costs
    IF v_cost_per_kg IS NULL THEN
        SELECT rlc.cost_per_kg, 1.80
        INTO v_cost_per_kg, v_cost_per_lb
        FROM route_logistics_costs rlc
        WHERE rlc.shipping_route_id = p_route_id 
        AND rlc.is_active = TRUE
        LIMIT 1;
    END IF;
    
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

-- ============================================================================
-- PASO 7: VERIFICACIÓN
-- ============================================================================

SELECT 'Transit Hubs' as table_name, COUNT(*) as count FROM transit_hubs
UNION ALL
SELECT 'Destination Countries', COUNT(*) FROM destination_countries
UNION ALL
SELECT 'Shipping Routes', COUNT(*) FROM shipping_routes
UNION ALL
SELECT 'Route Logistics Costs', COUNT(*) FROM route_logistics_costs
UNION ALL
SELECT 'Shipping Tiers', COUNT(*) FROM shipping_tiers
UNION ALL
SELECT 'Shipping Zones', COUNT(*) FROM shipping_zones;

SELECT 'Routes created:' as status;
SELECT sr.id, dc.name, th.name, sr.is_direct, sr.is_active
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN transit_hubs th ON sr.transit_hub_id = th.id;

SELECT 'Shipping Tiers:' as status;
SELECT tier_type, tier_name, transport_type, tramo_a_cost_per_kg, tramo_b_cost_per_lb
FROM shipping_tiers
ORDER BY priority_order;
