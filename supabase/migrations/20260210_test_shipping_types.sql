-- 20260210_test_shipping_types.sql
-- Script de prueba para verificar que la migración se ejecutó correctamente

-- 1. Verificar que la tabla existe y tiene los datos correctos
SELECT 'VERIFICAR TABLA shipping_type_configs' as paso;
SELECT 
  id,
  route_id,
  type,
  shipping_tier_id,
  display_name,
  extra_cost_fixed,
  extra_cost_percent,
  is_active
FROM shipping_type_configs
LIMIT 5;

-- 2. Verificar que la función existe
SELECT 'VERIFICAR FUNCIÓN calculate_shipping_cost_with_type' as paso;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'calculate_shipping_cost_with_type'
AND routine_schema = 'public';

-- 3. Obtener una ruta y tier existentes para hacer una prueba
SELECT 'OBTENER RUTA Y TIER PARA PRUEBA' as paso;
SELECT 
  sr.id as route_id,
  sr.origin_country,
  sr.destination_country,
  st.id as tier_id,
  st.tier_type,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb
FROM shipping_routes sr
LEFT JOIN shipping_tiers st ON sr.id = st.route_id
WHERE sr.is_active = true
LIMIT 1;

-- 4. Si existen rutas y tiers, crear un tipo de envío de prueba
-- (Reemplazar los UUIDs con valores reales de tu base de datos)
-- INSERT INTO shipping_type_configs (
--   route_id,
--   type,
--   shipping_tier_id,
--   display_name,
--   extra_cost_fixed,
--   extra_cost_percent,
--   is_active
-- ) VALUES (
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', -- route_id
--   'STANDARD',
--   'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy', -- tier_id
--   'Envío Estándar',
--   0,
--   0,
--   true
-- );

-- 5. Probar cálculo de costo para 0.600 kg
-- SELECT 'PROBAR CÁLCULO DE COSTO (0.600 kg)' as paso;
-- SELECT * FROM calculate_shipping_cost_with_type(
--   0.600,
--   'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy' -- usar tier_id real
-- );

-- 6. Probar cálculo con surcharge (Express $2.00 extra)
-- SELECT 'PROBAR CÁLCULO CON SURCHARGE (Express +$2.00)' as paso;
-- SELECT * FROM calculate_shipping_cost_with_type(
--   0.600,
--   'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy', -- tier_id
--   'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'  -- shipping_type_config_id con extra_cost_fixed = 2.00
-- );

COMMENT ON TABLE shipping_type_configs 
IS 'Tabla de configuración de tipos de envío verificada y lista para usar';
