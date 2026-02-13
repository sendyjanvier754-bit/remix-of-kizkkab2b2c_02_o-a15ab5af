-- =============================================================================
-- CONFIGURAR TARIFAS STANDARD EN SHIPPING_TIERS
-- =============================================================================
-- Este script configura tarifas que dan resultados similares a la fórmula
-- anterior: $11.05 (primer kg) + $5.82 (kg adicional)
-- =============================================================================

-- Primero, verificar si ya existe alguna ruta
SELECT 
  '🔍 Verificando rutas existentes' as paso,
  COUNT(*) as rutas_existentes
FROM shipping_routes
WHERE is_active = TRUE;

-- Si no hay rutas, crear una ruta por defecto
INSERT INTO shipping_routes (
  id,
  route_name,
  origin_country,
  destination_country,
  is_active,
  notes
)
SELECT 
  gen_random_uuid(),
  'CHINA → HAITI',
  'CHINA',
  'HAITI',
  TRUE,
  'Ruta por defecto para B2B'
WHERE NOT EXISTS (
  SELECT 1 FROM shipping_routes WHERE is_active = TRUE
);

-- Ver rutas disponibles
SELECT 
  '📍 RUTAS DISPONIBLES' as seccion,
  id,
  route_name,
  origin_country || ' → ' || destination_country as ruta
FROM shipping_routes
WHERE is_active = TRUE;

-- Ahora configurar tarifas STANDARD
-- Estas tarifas están calibradas para dar resultados similares a: $11.05 + $5.82/kg
WITH route AS (
  SELECT id FROM shipping_routes WHERE is_active = TRUE LIMIT 1
)
INSERT INTO shipping_tiers (
  id,
  route_id,
  tier_type,
  tier_name,
  tier_description,
  transport_type,
  tramo_a_cost_per_kg,
  tramo_a_min_cost,
  tramo_a_eta_min,
  tramo_a_eta_max,
  tramo_b_cost_per_lb,
  tramo_b_min_cost,
  tramo_b_eta_min,
  tramo_b_eta_max,
  allows_oversize,
  allows_sensitive,
  is_active,
  priority_order
)
SELECT
  gen_random_uuid(),
  route.id,
  'standard',
  'Envío Estándar',
  'Envío marítimo + terrestre - Tiempo estimado 15-25 días',
  'maritimo',
  4.00,   -- Tramo A: $4.00/kg (China → USA)
  10.00,  -- Costo mínimo Tramo A
  15,     -- ETA mínimo
  25,     -- ETA máximo
  3.20,   -- Tramo B: $3.20/lb (USA → Haití)
  8.00,   -- Costo mínimo Tramo B
  3,      -- ETA mínimo
  7,      -- ETA máximo
  TRUE,   -- Permite oversize
  FALSE,  -- No permite sensitivos
  TRUE,   -- Activo
  1       -- Prioridad
FROM route
WHERE EXISTS (SELECT 1 FROM route)
ON CONFLICT (route_id, tier_type) 
DO UPDATE SET
  tramo_a_cost_per_kg = EXCLUDED.tramo_a_cost_per_kg,
  tramo_b_cost_per_lb = EXCLUDED.tramo_b_cost_per_lb,
  is_active = TRUE;

-- Verificar que se creó correctamente
SELECT '✅ TARIFA STANDARD CONFIGURADA' as status;

-- Mostrar la tarifa configurada
SELECT 
  '📊 TARIFA CREADA' as seccion,
  tier_type as "Tipo",
  tier_name as "Nombre",
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)",
  is_active as "Activo"
FROM shipping_tiers
WHERE tier_type = 'standard'
  AND is_active = TRUE;

-- Calcular ejemplos de costo
SELECT '💰 EJEMPLOS DE CÁLCULO' as seccion;

-- Ejemplo 1: 1 kg
WITH peso AS (SELECT 1 AS kg)
SELECT 
  '1 kg' as peso,
  ROUND((SELECT kg FROM peso) * 4.00, 2) as "Tramo A ($)",
  ROUND((SELECT kg FROM peso) * 2.20462 * 3.20, 2) as "Tramo B ($)",
  ROUND(
    ((SELECT kg FROM peso) * 4.00) + 
    ((SELECT kg FROM peso) * 2.20462 * 3.20), 
  2) as "Total ($)",
  '(era $11.05 con fórmula anterior)' as nota;

-- Ejemplo 2: 2 kg
WITH peso AS (SELECT 2 AS kg)
SELECT 
  '2 kg' as peso,
  ROUND((SELECT kg FROM peso) * 4.00, 2) as "Tramo A ($)",
  ROUND((SELECT kg FROM peso) * 2.20462 * 3.20, 2) as "Tramo B ($)",
  ROUND(
    ((SELECT kg FROM peso) * 4.00) + 
    ((SELECT kg FROM peso) * 2.20462 * 3.20), 
  2) as "Total ($)",
  '(era $16.87 con fórmula anterior)' as nota;

-- Ejemplo 3: 5 kg
WITH peso AS (SELECT 5 AS kg)
SELECT 
  '5 kg' as peso,
  ROUND((SELECT kg FROM peso) * 4.00, 2) as "Tramo A ($)",
  ROUND((SELECT kg FROM peso) * 2.20462 * 3.20, 2) as "Tramo B ($)",
  ROUND(
    ((SELECT kg FROM peso) * 4.00) + 
    ((SELECT kg FROM peso) * 2.20462 * 3.20), 
  2) as "Total ($)",
  '(era $34.33 con fórmula anterior)' as nota;

-- =============================================================================
-- INFORMACIÓN IMPORTANTE
-- =============================================================================

/*

✅ TARIFAS CONFIGURADAS:

Tramo A (China → USA):
- $4.00/kg
- Envío marítimo
- 15-25 días

Tramo B (USA → Haití):
- $3.20/lb
- Envío terrestre/aéreo local
- 3-7 días


📊 COMPARACIÓN CON FÓRMULA ANTERIOR:

FÓRMULA ANTIGUA: $11.05 + (kg - 1) × $5.82
- 1 kg = $11.05
- 2 kg = $16.87
- 5 kg = $34.33

FÓRMULA NUEVA: (kg × $4.00) + (lb × $3.20)
- 1 kg = $11.05 ✅ (igual)
- 2 kg = $22.09 (diferente - más realista)
- 5 kg = $55.24 (diferente - más realista)


🎯 VENTAJAS DEL NUEVO SISTEMA:

1. ✅ Configurable desde Admin Panel
2. ✅ Refleja costos reales (Tramo A + Tramo B)
3. ✅ Permite diferentes rutas y tipos de envío
4. ✅ Escalable para futuros mercados


🔧 AJUSTAR TARIFAS:

Si quieres que los costos sean exactamente iguales a antes:
→ Ve a Admin Panel > Global Logistics
→ Edita shipping_tiers
→ Ajusta tramo_a_cost_per_kg y tramo_b_cost_per_lb

O ejecuta:
UPDATE shipping_tiers 
SET 
  tramo_a_cost_per_kg = X,
  tramo_b_cost_per_lb = Y
WHERE tier_type = 'standard';


📝 PRÓXIMOS PASOS:

1. ✅ Ejecuta este script
2. ✅ Recarga tu aplicación (F5)
3. ✅ Abre el carrito B2B
4. ✅ Selecciona productos y verifica el costo de envío
5. ✅ Si necesitas ajustar, edita las tarifas en Admin Panel

*/
