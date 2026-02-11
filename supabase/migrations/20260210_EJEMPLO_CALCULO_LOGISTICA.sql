-- 20260210_EJEMPLO_CALCULO_LOGISTICA.sql
-- Ejemplo de cálculo de costo de logística con tipos de envío vinculados a rutas

-- CASO DE USO: 2 productos de 0.300 kg cada uno
-- Según la configuración actual:
-- - Ruta: China → China Hub → Haiti (Activo)
-- - Tramo A (Origen → Hub): $3.50/kg, 7-14 días
-- - Tramo B (Hub → Destino): $5.00/lb, 3-7 días

-- 1. CÁLCULO BÁSICO (SIN CARGO EXTRA)
-- ======================================
-- Total weight: 0.300 kg × 2 = 0.600 kg
-- 
-- Fórmula: (weight_kg × tramo_a_cost_per_kg) + (weight_kg × 2.20462 lb/kg × tramo_b_cost_per_lb)
-- 
-- Cálculo:
-- - Tramo A: 0.600 kg × $3.50/kg = $2.10
-- - Tramo B: 0.600 kg × 2.20462 × $5.00/lb = 0.600 × 2.20462 × $5.00 = $6.61
-- - TOTAL: $2.10 + $6.61 = $8.71

-- 2. VERIFICAR CONFIGURACIÓN ACTUAL EN BASEDATOS
-- ================================================

-- Ver todas las rutas y sus tipos de envío asociados:
SELECT 
  sr.id as route_id,
  sr.origin_country,
  sr.hub_location,
  sr.destination_country,
  stc.type as shipping_type,
  stc.display_name,
  st.tier_type,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.tramo_a_eta_min || '-' || st.tramo_a_eta_max || ' días' as tramo_a_eta,
  st.tramo_b_eta_min || '-' || st.tramo_b_eta_max || ' días' as tramo_b_eta,
  stc.extra_cost_fixed,
  stc.extra_cost_percent,
  stc.is_active
FROM shipping_routes sr
LEFT JOIN shipping_type_configs stc ON stc.route_id = sr.id
LEFT JOIN shipping_tiers st ON st.id = stc.shipping_tier_id
WHERE sr.destination_country ILIKE '%haiti%'
ORDER BY sr.id, stc.priority_order;

-- 3. EJEMPLO: CALCULAR COSTO PARA 0.600 KG CON TIPO DE ENVÍO
-- ==========================================================

-- Obtener la ruta China → Haiti
WITH route_info AS (
  SELECT id FROM shipping_routes 
  WHERE origin_country ILIKE '%china%' 
    AND destination_country ILIKE '%haiti%'
  LIMIT 1
),
-- Obtener el tipo de envío STANDARD de esa ruta
standard_type AS (
  SELECT id, shipping_tier_id, extra_cost_fixed, extra_cost_percent
  FROM shipping_type_configs
  WHERE route_id = (SELECT id FROM route_info)
    AND type = 'STANDARD'
    AND is_active = true
  LIMIT 1
),
-- Obtener el tipo de envío EXPRESS de esa ruta
express_type AS (
  SELECT id, shipping_tier_id, extra_cost_fixed, extra_cost_percent
  FROM shipping_type_configs
  WHERE route_id = (SELECT id FROM route_info)
    AND type = 'EXPRESS'
    AND is_active = true
  LIMIT 1
)
-- Calcular costos (peso total: 0.600 kg)
SELECT 
  '2 productos × 0.300 kg' as description,
  'STANDARD' as type,
  (SELECT total_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM standard_type), (SELECT id FROM standard_type))) as total_cost,
  (SELECT base_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM standard_type), (SELECT id FROM standard_type))) as base_cost,
  (SELECT extra_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM standard_type), (SELECT id FROM standard_type))) as extra_cost,
  (SELECT display_name FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM standard_type), (SELECT id FROM standard_type))) as display_name
UNION ALL
SELECT 
  '2 productos × 0.300 kg' as description,
  'EXPRESS' as type,
  (SELECT total_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM express_type), (SELECT id FROM express_type))) as total_cost,
  (SELECT base_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM express_type), (SELECT id FROM express_type))) as base_cost,
  (SELECT extra_cost FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM express_type), (SELECT id FROM express_type))) as extra_cost,
  (SELECT display_name FROM public.calculate_shipping_cost_with_type(0.600, (SELECT shipping_tier_id FROM express_type), (SELECT id FROM express_type))) as display_name;

-- 4. ESTRUCTURA DE DATOS
-- =====================
-- 
-- IMPORTANTE: Los tipos de envío USAN las tarifas del Tier asignado
-- ════════════════════════════════════════════════════════════════
-- 
-- Los Tipos de Envío (Standard/Express) NO definen sus propias tarifas.
-- SIEMPRE usan las tarifas del Tier (tramo_a_cost_per_kg, tramo_b_cost_per_lb)
-- que se asigna al tipo.
-- 
-- Los tipos de envío solo pueden AGREGAR cargos extras (surcharges):
-- - extra_cost_fixed: Cargo fijo adicional (ej: $2.00 para Express)
-- - extra_cost_percent: Cargo porcentual adicional (ej: 10% para Prioridad)
--
-- Estructura:
-- shipping_routes (rutas)
--   └─ shipping_type_configs (tipos de envío vinculados)
--      ├─ shipping_tier_id → shipping_tiers (USAMOS ESTAS TARIFAS)
--      │  └─ tramo_a_cost_per_kg
--      │  └─ tramo_b_cost_per_lb
--      ├─ extra_cost_fixed (CARGO EXTRA opcional)
--      └─ extra_cost_percent (CARGO EXTRA opcional)
--
-- FÓRMULA:
-- Total = (weight_kg × tramo_a) + (weight_kg × 2.20462 × tramo_b) + extras
--         └─── TARIFAS DEL TIER ASIGNADO ────────────────────────┘

-- 5. REGLAS DE VALIDACIÓN
-- =======================
-- 
-- ✓ Un Tipo de Envío DEBE estar vinculado a una Ruta específica
-- ✓ Un Tipo de Envío DEBE referenciar un Tier que pertenezca a la misma Ruta
-- ✓ Los Tipos de Envío USAN las tarifas del Tier asignado (NO pueden cambiarlas)
-- ✓ Los Tipos de Envío solo pueden AGREGAR cargos extras fijos y/o porcentuales
-- ✓ No se puede crear un Tipo de Envío sin seleccionar Ruta y Tier
-- ✓ El costo total = (TARIFAS_DEL_TIER) + (CARGOS_EXTRA_DEL_TIPO)
--
-- EJEMPLOS DE TIPOS CON MISMO TIER PERO DIFERENTES EXTRAS:
-- ============================================================
-- 
-- Tipo: Standard
--   Tier: Origen→Hub $3.50/kg, Hub→Destino $5.00/lb
--   Cargo Extra: $0.00 fijo, 0% porcentual
--   Costo 0.6kg = (0.6×$3.50) + (0.6×2.20462×$5.00) + $0.00 = $8.71
--
-- Tipo: Express (mismo tier que Standard)
--   Tier: Origen→Hub $3.50/kg, Hub→Destino $5.00/lb (IDÉNTICO)
--   Cargo Extra: $2.00 fijo, 0% porcentual
--   Costo 0.6kg = (0.6×$3.50) + (0.6×2.20462×$5.00) + $2.00 = $10.71
--
-- Tipo: Prioridad (mismo tier que Standard)
--   Tier: Origen→Hub $3.50/kg, Hub→Destino $5.00/lb (IDÉNTICO)
--   Cargo Extra: $0.00 fijo, 15% porcentual
--   Costo 0.6kg = (0.6×$3.50) + (0.6×2.20462×$5.00) + ($8.71 × 15%) = $10.01

-- 6. FLUJO EN LA UI (IMPORTANTE)
-- =============================
-- 
-- Los Tipos de Envío NO pueden tener sus propias tarifas.
-- Siempre usan las tarifas del TIER que se asigna.
--
-- Crear/Editar Tipo de Envío:
-- 
-- 1. Seleccionar RUTA (obligatorio)
--    └─ Define el recorrido (China → China Hub → Haiti)
-- 
-- 2. Seleccionar TIER dentro de esa RUTA (obligatorio)
--    └─ Define las TARIFAS base:
--       ├─ Tramo A: $X.XX/kg
--       ├─ Tramo B: $Y.YY/lb
--       └─ ETA: Z-W días
--    └─ El tipo de envío USARÁ estas tarifas exactas
--    └─ NO se pueden cambiar/reemplazar por el tipo
--
-- 3. Ingresar TIPO (STANDARD/EXPRESS/etc) (obligatorio)
--    └─ Validación: No duplicar tipo en misma ruta
--    └─ Este es solo un nombre/categoría
--
-- 4. Ingresar CARGAS EXTRAS (opcional)
--    └─ Extra fijo ($): ej. $2.00 (se suma a todo pedido)
--    └─ Extra %: ej. 10% (porcentaje del costo base)
--    └─ IMPORTANTE: Estos son CARGOS ADICIONALES
--       No modifican las tarifas del Tier
--
-- 5. Configuraciones adicionales (opcional)
--    └─ Permite oversize: true/false
--    └─ Permite sensibles: true/false
--    └─ Peso mín/máx: restricciones por tipo
--
-- 6. Guardar
--    └─ Sistema valida que el Tier pertenezca a la Ruta
--    └─ Crea vínculo: Ruta → Tier (tarifas) → Tipo (nombre + extras)

-- 7. CÁLCULO EN ORDEN B2B
-- =======================
-- Al crear una orden con tipo de envío:
-- 
-- 1. Validar peso dentro de rango permitido por tipo
-- 2. Validar restricciones de oversize/sensibles
-- 3. Obtener el TIER asignado al tipo
-- 4. Calcular costo automáticamente:
--    Costo = (weight_kg × tier.tramo_a_costo) 
--          + (weight_kg × 2.20462 × tier.tramo_b_costo)
--          + tipo.extra_cost_fixed
--          + (costo_base × tipo.extra_cost_percent / 100)
--
-- 5. Mostrar desglose completo al usuario:
--    ┌─────────────────────────────────────┐
--    │ Envío Standard (Ruta: China→Haiti)  │
--    ├─────────────────────────────────────┤
--    │ Tarifas (del Tier asignado):        │
--    │  Tramo A: $3.50/kg                  │
--    │  Tramo B: $5.00/lb                  │
--    ├─────────────────────────────────────┤
--    │ Cálculo (peso: 0.600 kg):           │
--    │  Tramo A: 0.600 × $3.50 = $2.10    │
--    │  Tramo B: 0.600 × 2.20462 × $5.00  │
--    │           = $6.61                   │
--    │  Costo Base: $8.71                  │
--    │                                     │
--    │  Cargo Extra (Standard): $0.00      │
--    ├─────────────────────────────────────┤
--    │ TOTAL: $8.71                        │
--    │ ETA: 3-14 días                      │
--    └─────────────────────────────────────┘
