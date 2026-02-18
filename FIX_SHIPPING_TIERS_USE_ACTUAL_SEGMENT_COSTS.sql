-- ============================================================================
-- FIX: ACTUALIZAR SHIPPING_TIERS CON COSTOS REALES DE ROUTE_LOGISTICS_COSTS
-- ============================================================================
-- 
-- PROBLEMA:
-- Los registros en shipping_tiers tienen costos hardcodeados (8.0000, 5.0000)
-- que NO coinciden con los costos reales configurados en route_logistics_costs.
--
-- SOLUCIÓN:
-- Actualizar cada shipping_tier con los costos de sus segmentos correspondientes
-- ============================================================================

-- PASO 1: Ver el estado actual
SELECT 
  'ANTES: Tiers con costos actuales' as estado,
  st.tier_name,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  CONCAT(st.tramo_a_eta_min + st.tramo_b_eta_min, '-', st.tramo_a_eta_max + st.tramo_b_eta_max, ' días') as eta_total
FROM public.shipping_tiers st
ORDER BY st.transport_type, st.priority_order;

-- PASO 2: Actualizar tiers con costos de segmentos
UPDATE public.shipping_tiers st
SET 
  -- Tramo A (China → Hub): costo por kg
  tramo_a_cost_per_kg = seg_a.cost_per_kg,
  tramo_a_eta_min = seg_a.estimated_days_min,
  tramo_a_eta_max = seg_a.estimated_days_max,
  
  -- Tramo B (Hub → Destino): convertir kg a lb (1 kg = 2.20462 lb)
  tramo_b_cost_per_lb = seg_b.cost_per_kg * 2.20462,
  tramo_b_eta_min = seg_b.estimated_days_min,
  tramo_b_eta_max = seg_b.estimated_days_max,
  
  updated_at = NOW()
FROM public.shipping_routes sr
LEFT JOIN public.route_logistics_costs seg_a 
  ON seg_a.shipping_route_id = sr.id 
  AND seg_a.segment = 'china_to_transit'
  AND seg_a.is_active = TRUE
LEFT JOIN public.route_logistics_costs seg_b 
  ON seg_b.shipping_route_id = sr.id 
  AND seg_b.segment = 'transit_to_destination'
  AND seg_b.is_active = TRUE
WHERE st.route_id = sr.id
  AND seg_a.transport_type = st.transport_type
  AND seg_b.transport_type = st.transport_type
  AND seg_a.cost_per_kg IS NOT NULL
  AND seg_b.cost_per_kg IS NOT NULL;

-- PASO 3: Verificar actualización
SELECT 
  'DESPUÉS: Tiers actualizados' as estado,
  st.tier_name,
  st.custom_tier_name,
  st.transport_type,
  CONCAT(st.tramo_a_cost_per_kg, ' $/kg') as tramo_a_costo,
  CONCAT(st.tramo_b_cost_per_lb, ' $/lb') as tramo_b_costo,
  CONCAT(st.tramo_a_eta_min + st.tramo_b_eta_min, '-', st.tramo_a_eta_max + st.tramo_b_eta_max, ' días') as eta_total,
  st.is_active
FROM public.shipping_tiers st
ORDER BY st.transport_type, st.priority_order;

-- ✅ COMPLETADO
-- Los tiers ahora usan los costos reales de route_logistics_costs
-- El botón "Cargar desde Segmentos" en el admin permite recargar los valores cuando cambien
