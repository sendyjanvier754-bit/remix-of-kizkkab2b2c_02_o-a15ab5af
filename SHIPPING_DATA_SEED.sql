-- ============================================================================
-- DATOS DE PRUEBA: Rutas y Zonas de Envío
-- Propósito: Datos iniciales para probar la función de cálculo de costos
-- Fecha: 2026-02-06
-- ============================================================================

-- 1. INSERTAR RUTAS DE ENVÍO
-- ============================================================================
INSERT INTO shipping_routes (route_name, origin_hub, destination_hub, cost_per_kg, cost_per_lb, oversize_volume_factor, is_active)
VALUES
    -- Tramo A: China a USA
    ('CHINA-USA', 'CHINA_HUB', 'USA_HUB', 3.50, 1.80, 5000, TRUE),
    
    -- Tramo B: USA a Haití (ejemplo Destino Final)
    ('USA-HAITI', 'USA_HUB', 'HAITI_MAIN', 5.00, 2.50, 5000, TRUE),
    
    -- Ruta Express (si aplica)
    ('CHINA-USA-EXPRESS', 'CHINA_HUB', 'USA_HUB', 5.50, 2.80, 5000, TRUE);

-- 2. INSERTAR TIPOS DE ENVÍO POR RUTA
-- ============================================================================
-- CHINA-USA: Permite STANDARD y EXPRESS
INSERT INTO shipping_types_per_route (route_id, shipping_type, is_available)
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA'
UNION ALL
SELECT id, 'EXPRESS', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA'

-- USA-HAITI: Solo STANDARD (destinos finales típicamente no ofertan Express)
UNION ALL
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'USA-HAITI'

-- EXPRESS: Solo STANDARD (no tiene sentido EXPRESS en destino final)
UNION ALL
SELECT id, 'STANDARD', TRUE FROM shipping_routes WHERE route_name = 'CHINA-USA-EXPRESS';

-- 3. INSERTAR ZONAS DE ENVÍO
-- ============================================================================
INSERT INTO shipping_zones (zone_name, country, department_or_state, final_delivery_surcharge, is_active)
VALUES
    ('HAITI_CENTRO', 'HAITI', 'OUEST', 5.00, TRUE),
    ('HAITI_NORTE', 'HAITI', 'NORD', 7.50, TRUE),
    ('HAITI_SUR', 'HAITI', 'SUD', 6.50, TRUE),
    ('USA_CONTIGUOUS', 'USA', NULL, 0.00, TRUE),
    ('USA_ALASKA', 'USA', 'ALASKA', 15.00, TRUE),
    ('USA_HAWAII', 'USA', 'HAWAII', 20.00, TRUE);

-- ============================================================================
-- NOTAS SOBRE LOS DATOS:
-- 1. cost_per_kg: Costo del Tramo A (China-USA) por kilogramo
-- 2. cost_per_lb: Costo del Tramo B (USA-Destino) por libra
-- 3. oversize_volume_factor: Factor volumétrico (típicamente 5000-6000 cm³/kg)
-- 4. final_delivery_surcharge: Recargo adicional por zona de destino
-- 5. Estos datos son ejemplos y deben reemplazarse con tarifas reales
-- ============================================================================
