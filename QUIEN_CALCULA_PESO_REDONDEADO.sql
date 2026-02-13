-- =============================================================================
-- EXPLICACIÓN: ¿Quién calcula el precio del peso redondeado?
-- Fecha: 2026-02-12
-- =============================================================================

/*
RESPUESTA CORTA:
===============
La FUNCIÓN calculate_shipping_cost_cart() calcula el precio usando el peso 
redondeado. La vista v_cart_shipping_costs solo LLAMA a la función y muestra 
los resultados.


FLUJO COMPLETO:
===============

┌─────────────────────────────────────────────────────────────────┐
│ PASO 1: Vista v_cart_shipping_costs                            │
│ ────────────────────────────────────────────                   │
│ - Obtiene carrito simulado (10 productos)                      │
│ - Calcula: total_weight_kg = SUM(weight_kg × quantity)        │
│ - Ejemplo: 10 productos × 0.2 kg c/u = 2.0 kg                 │
│                                                                 │
│ ⚠️ LA VISTA NO REDONDEA - Pasa peso exacto 2.0 kg             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 2: Llamada a función                                      │
│ ────────────────────────────────                               │
│ calculate_shipping_cost_cart(                                  │
│   route_id,                                                     │
│   2.0,           ← Peso SIN redondear                          │
│   shipping_type_id,                                            │
│   has_oversize,                                                │
│   max_length, max_width, max_height                            │
│ )                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: FUNCIÓN calculate_shipping_cost_cart()                 │
│ ═══════════════════════════════════════════════════════════════ │
│                                                                 │
│ LÍNEA 165 (DENTRO DE LA FUNCIÓN):                             │
│ v_weight_rounded := CEIL(p_total_weight_kg);                  │
│                                                                 │
│ ✅ AQUÍ SE REDONDEA: 2.0 → CEIL(2.0) → 2 kg                   │
│                                                                 │
│ ────────────────────────────────                               │
│                                                                 │
│ LÍNEA 170-178: Obtener tarifas por kg                         │
│ v_tramo_a_cost = 3.50 USD/kg (China → Tránsito)              │
│ v_tramo_b_cost = 5.00 USD/lb (Tránsito → Haití)              │
│                                                                 │
│ ────────────────────────────────                               │
│                                                                 │
│ LÍNEA 183: Calcular costo base CON PESO REDONDEADO            │
│ v_base_cost := (v_weight_rounded * v_tramo_a_cost) +          │
│                (v_weight_rounded * 2.20462 * v_tramo_b_cost); │
│                                                                 │
│ Cálculo:                                                        │
│   Tramo A: 2 kg × 3.50 USD/kg = 7.00 USD                      │
│   Tramo B: 2 kg × 2.20462 lb/kg × 5.00 USD/lb = 22.05 USD    │
│   TOTAL: 7.00 + 22.05 = 29.05 USD                             │
│                                                                 │
│ ────────────────────────────────                               │
│                                                                 │
│ LÍNEA 192-209: Calcular surcharges                            │
│ - Oversize surcharge: +15% si is_oversize = TRUE              │
│ - Dimensional surcharge: +10% si volumen > 0.15 m³            │
│                                                                 │
│ ────────────────────────────────                               │
│                                                                 │
│ LÍNEA 211-228: Calcular extra_cost del tipo de envío          │
│ - extra_cost_fixed: Cargo fijo                                 │
│ - extra_cost_percent: % del costo base                         │
│                                                                 │
│ ────────────────────────────────                               │
│                                                                 │
│ LÍNEA 230-241: RETURN con resultados calculados               │
│ RETURN QUERY SELECT                                            │
│   v_weight_rounded,              ← 2 kg (redondeado)          │
│   ROUND(v_base_cost, 2),         ← 29.05 USD                  │
│   v_oversize_surcharge,          ← 0 USD                      │
│   v_dimensional_surcharge,       ← 0 USD                      │
│   ROUND(v_extra_cost, 2),        ← 0 USD                      │
│   ROUND(total_cost_with_type, 2), ← 29.05 USD (TOTAL)        │
│   v_type_name,                    ← 'STANDARD'                │
│   v_type_display,                 ← 'Envío Estándar'          │
│   v_volume_m3;                    ← 0.000000 m³               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PASO 4: Vista recibe resultados                                │
│ ────────────────────────────────────────────                   │
│ v_cart_shipping_costs muestra:                                 │
│ - weight_rounded_kg: 2                                          │
│ - base_cost: 29.05                                              │
│ - total_cost_with_type: 29.05                                   │
│                                                                 │
│ ⚠️ LA VISTA NO HACE CÁLCULOS - Solo presenta datos            │
└─────────────────────────────────────────────────────────────────┘


RESUMEN:
========

┌──────────────────────┬─────────────────────────────────────────────┐
│ QUIÉN                │ QUÉ HACE                                    │
├──────────────────────┼─────────────────────────────────────────────┤
│ Vista                │ 1. Obtiene productos del carrito            │
│ v_cart_shipping_     │ 2. Calcula peso total SIN redondear         │
│ costs                │ 3. Llama a la función con peso exacto       │
│                      │ 4. Presenta resultados devueltos           │
├──────────────────────┼─────────────────────────────────────────────┤
│ Función              │ 1. ✅ REDONDEA el peso con CEIL()          │
│ calculate_shipping_  │ 2. ✅ CALCULA costo base con peso redondeado│
│ cost_cart()          │ 3. ✅ CALCULA surcharges                   │
│                      │ 4. ✅ CALCULA extra costs                  │
│                      │ 5. ✅ RETORNA todos los valores calculados │
└──────────────────────┴─────────────────────────────────────────────┘


EJEMPLO REAL (2 kg):
====================

Input a la función:    2.0 kg (peso exacto del carrito)
                       ↓
Dentro de la función:  CEIL(2.0) = 2 kg
                       ↓
Cálculo Tramo A:       2 kg × 3.50 = 7.00 USD
Cálculo Tramo B:       2 kg × 2.20462 × 5.00 = 22.05 USD
                       ↓
Costo base:            7.00 + 22.05 = 29.05 USD
Surcharges:            0 + 0 + 0 = 0 USD
                       ↓
COSTO TOTAL:           29.05 USD ✅


CÓDIGO RELEVANTE:
=================

Archivo: MIGRACION_CORREGIDA_MISMO_ORIGEN_DATOS.sql
Línea 165:
  v_weight_rounded := CEIL(p_total_weight_kg);

Línea 183:
  v_base_cost := (v_weight_rounded * v_tramo_a_cost) + 
                 (v_weight_rounded * 2.20462 * v_tramo_b_cost);

Línea 230:
  RETURN QUERY SELECT 
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    ...


VENTAJAS DE ESTE DISEÑO:
========================

✅ Separación de responsabilidades:
   - Vista: Obtiene datos y presenta
   - Función: Lógica de negocio y cálculos

✅ Reutilizable:
   - La función puede ser llamada desde cualquier lugar
   - No depende de la vista

✅ Centralizado:
   - Un solo lugar donde se calcula el costo
   - Fácil de mantener y actualizar

✅ Consistente:
   - Todos los costos se calculan con la misma lógica
   - No hay duplicación de código

*/

-- =============================================================================
-- CONSULTA PARA VERIFICAR EL FLUJO
-- =============================================================================

-- 1. Ver peso exacto del carrito (calculado por la vista)
WITH cart_items AS (
  SELECT 
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
    1 as quantity
  FROM products p
  WHERE p.is_active = TRUE
  ORDER BY p.nombre
  LIMIT 10
)
SELECT 
  'Peso calculado por vista' as paso,
  SUM(weight_kg * quantity) as peso_exacto_kg,
  CEIL(SUM(weight_kg * quantity)) as peso_redondeado_kg,
  'Vista NO redondea, pasa peso exacto a función' as nota
FROM cart_items;

-- 2. Ver resultado de la función (incluye peso redondeado)
WITH route_data AS (
  SELECT sr.id as route_id
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' AND dc.code = 'HT' AND sr.is_active = TRUE
  LIMIT 1
)
SELECT 
  'Resultado de función' as paso,
  weight_rounded_kg as peso_redondeado_kg,
  base_cost as costo_base_htg,
  total_cost_with_type as costo_total_htg,
  'Función REDONDEA y CALCULA' as nota
FROM calculate_shipping_cost_cart(
  (SELECT route_id FROM route_data),
  2.0,  -- Peso exacto pasado por la vista
  (SELECT id FROM shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
  FALSE,
  NULL,
  NULL,
  NULL
);
