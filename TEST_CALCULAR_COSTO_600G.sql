-- =============================================================================
-- TEST: Calcular costo de logística para 2 productos de 0.300 kg (600g total)
-- =============================================================================

/*
ESCENARIO:
==========
- Producto 1: 0.300 kg × 1 unidad = 0.300 kg
- Producto 2: 0.300 kg × 1 unidad = 0.300 kg
- Total: 0.600 kg
- Peso redondeado: CEIL(0.600) = 1 kg

CÁLCULO ESPERADO:
=================
Tramo A: 1 kg × 3.50 USD/kg = 3.50 USD
Tramo B: 1 kg × 2.20462 lb/kg × 5.00 USD/lb = 11.02 USD
Base Cost: 3.50 + 11.02 = 14.52 USD

Sin surcharges (productos normales):
TOTAL: $14.52 USD ✅
*/

-- =============================================================================
-- OPCIÓN 1: Simular carrito con función dinámica (sin productos reales)
-- =============================================================================

SELECT 
  '🧪 Test: 2 productos de 0.300 kg cada uno' as escenario,
  total_items as items,
  ROUND(total_weight_kg::numeric, 3) as peso_total_kg,
  weight_rounded_kg as peso_redondeado_kg,
  ROUND(base_cost::numeric, 2) as costo_base_usd,
  ROUND(oversize_surcharge::numeric, 2) as surcharge_oversize_usd,
  ROUND(dimensional_surcharge::numeric, 2) as surcharge_dimensional_usd,
  ROUND(extra_cost::numeric, 2) as costo_extra_usd,
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL_USD",
  shipping_type_display as tipo_envio
FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 1},
  {"product_id": "00000000-0000-0000-0000-000000000002", "quantity": 1}
]'::jsonb);

-- Nota: Los product_id son ficticios pero la función los buscará en DB
-- Si no existen, retornará peso 0


-- =============================================================================
-- OPCIÓN 2: Con productos reales que pesen ~0.300 kg
-- =============================================================================

-- Paso 1: Buscar productos que pesen entre 0.250 y 0.350 kg
SELECT 
  id,
  nombre,
  COALESCE(weight_kg, peso_kg, weight_g / 1000.0, peso_g / 1000.0) as peso_kg,
  is_oversize
FROM products
WHERE is_active = true
  AND (
    (weight_kg BETWEEN 0.250 AND 0.350) 
    OR (peso_kg BETWEEN 0.250 AND 0.350)
    OR (weight_g / 1000.0 BETWEEN 0.250 AND 0.350)
    OR (peso_g / 1000.0 BETWEEN 0.250 AND 0.350)
  )
ORDER BY nombre
LIMIT 5;

-- Paso 2: Copiar 2 IDs de productos reales y ejecutar
-- (Reemplaza los UUIDs con IDs reales del paso anterior)

/*
SELECT 
  '🧪 Test: 2 productos reales de ~0.300 kg' as escenario,
  total_items as items,
  ROUND(total_weight_kg::numeric, 3) as peso_total_kg,
  weight_rounded_kg as peso_redondeado_kg,
  ROUND(base_cost::numeric, 2) as costo_base_usd,
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL_USD"
FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "PEGAR-ID-PRODUCTO-1-AQUI", "quantity": 1},
  {"product_id": "PEGAR-ID-PRODUCTO-2-AQUI", "quantity": 1}
]'::jsonb);
*/


-- =============================================================================
-- OPCIÓN 3: Calcular directamente con peso especificado
-- =============================================================================

-- Llamar directamente a calculate_shipping_cost_cart con 1 kg
WITH test_params AS (
  SELECT 
    '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid as route_id,  -- Ruta CHINA → HT
    0.600::numeric as peso_kg,  -- Peso total sin redondear
    (SELECT id FROM shipping_type_configs WHERE type = 'STANDARD' LIMIT 1) as shipping_type_id,
    false as is_oversize,
    20.0::numeric as max_length_cm,  -- Dimensiones normales
    15.0::numeric as max_width_cm,
    10.0::numeric as max_height_cm
)
SELECT 
  '🧪 Test: Cálculo directo con 0.600 kg' as test,
  peso_kg as peso_original_kg,
  weight_rounded_kg as peso_redondeado_kg,
  ROUND(base_cost::numeric, 2) as costo_base_usd,
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL_USD",
  shipping_type_display as tipo_envio
FROM test_params,
LATERAL calculate_shipping_cost_cart(
  test_params.route_id,
  test_params.peso_kg,
  test_params.shipping_type_id,
  test_params.is_oversize,
  test_params.max_length_cm,
  test_params.max_width_cm,
  test_params.max_height_cm
);


-- =============================================================================
-- VERIFICACIÓN: Desglose paso a paso
-- =============================================================================

WITH calculos AS (
  SELECT 
    0.600 as peso_original_kg,
    CEIL(0.600) as peso_redondeado_kg
)
SELECT 
  '📊 Desglose del cálculo' as info,
  peso_original_kg,
  peso_redondeado_kg,
  
  -- Tramo A
  ROUND((peso_redondeado_kg * 3.50)::numeric, 2) as "Tramo A (3.50 USD/kg)",
  
  -- Tramo B
  ROUND((peso_redondeado_kg * 2.20462 * 5.00)::numeric, 2) as "Tramo B (5.00 USD/lb)",
  
  -- Total
  ROUND((peso_redondeado_kg * 3.50 + peso_redondeado_kg * 2.20462 * 5.00)::numeric, 2) as "💰 TOTAL_USD"
FROM calculos;


-- =============================================================================
-- RESULTADO ESPERADO:
-- =============================================================================

/*
┌─────────────────────┬──────────────────┐
│ Campo               │ Valor Esperado   │
├─────────────────────┼──────────────────┤
│ peso_original_kg    │ 0.600           │
│ peso_redondeado_kg  │ 1               │
│ Tramo A             │ 3.50 USD        │
│ Tramo B             │ 11.02 USD       │
│ 💰 TOTAL_USD        │ 14.52 USD       │
└─────────────────────┴──────────────────┘

Si los productos son oversize:
  + Surcharge 15% = 14.52 × 1.15 = 16.70 USD

Si volumen > 0.15 m³:
  + Surcharge 10% = 14.52 × 1.10 = 15.97 USD

Si ambos:
  TOTAL = 14.52 × 1.15 × 1.10 = 18.37 USD
*/


-- =============================================================================
-- VALORES DE REFERENCIA
-- =============================================================================

/*
TABLA DE REFERENCIA RÁPIDA:
============================

Peso Real | Redondeado | Tramo A | Tramo B  | TOTAL
----------|------------|---------|----------|-------
0.300 kg  | 1 kg       | 3.50    | 11.02    | 14.52
0.600 kg  | 1 kg       | 3.50    | 11.02    | 14.52  ← TU CASO
0.900 kg  | 1 kg       | 3.50    | 11.02    | 14.52
1.000 kg  | 1 kg       | 3.50    | 11.02    | 14.52
1.100 kg  | 2 kg       | 7.00    | 22.05    | 29.05
1.500 kg  | 2 kg       | 7.00    | 22.05    | 29.05
2.000 kg  | 2 kg       | 7.00    | 22.05    | 29.05
2.100 kg  | 3 kg       | 10.50   | 33.07    | 43.57

Nota: Todos los costos en USD, sin surcharges

FÓRMULAS:
=========
Tramo A: peso_redondeado × 3.50 USD/kg
Tramo B: peso_redondeado × 2.20462 lb/kg × 5.00 USD/lb
TOTAL: Tramo A + Tramo B + Surcharges + Extra Cost
*/
