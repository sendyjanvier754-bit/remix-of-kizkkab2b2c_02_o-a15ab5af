-- Ver todos los segmentos (tramos) configurados por ruta
SELECT 
  '📦 Segmentos por Ruta' as info,
  sr.id as route_id,
  dc.nombre as destination_country,
  th.nombre as hub,
  rlc.segment,
  rlc.transport_type,
  rlc.cost_per_kg,
  rlc.cost_per_cbm,
  rlc.min_cost,
  rlc.estimated_days_min,
  rlc.estimated_days_max,
  rlc.is_active,
  rlc.notes
FROM public.route_logistics_costs rlc
JOIN public.shipping_routes sr ON rlc.shipping_route_id = sr.id
JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
ORDER BY sr.id, rlc.transport_type, rlc.segment;

-- Ver relación entre shipping_tiers y sus rutas
SELECT 
  '🎯 Shipping Tiers y sus Rutas' as info,
  st.id as tier_id,
  st.tier_type,
  st.tier_name,
  st.custom_tier_name,
  st.transport_type,
  sr.id as route_id,
  dc.nombre as destination_country,
  th.nombre as hub,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max
FROM public.shipping_tiers st
JOIN public.shipping_routes sr ON st.route_id = sr.id  
JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
ORDER BY sr.id, st.priority_order;

-- Comparar: ¿Los tiers tienen los mismos valores que sus segmentos?
SELECT 
  '⚠️ Comparación Tiers vs Segmentos' as info,
  st.tier_name,
  st.transport_type as tier_transport,
  st.tramo_a_cost_per_kg as tier_tramo_a_cost,
  rlc.transport_type as segment_transport,
  rlc.cost_per_kg as segment_cost_per_kg,
  CASE 
    WHEN st.tramo_a_cost_per_kg = rlc.cost_per_kg THEN '✅ Coincide'
    ELSE '❌ NO COINCIDE'
  END as comparacion
FROM public.shipping_tiers st
JOIN public.shipping_routes sr ON st.route_id = sr.id
LEFT JOIN public.route_logistics_costs rlc 
  ON rlc.shipping_route_id = sr.id 
  AND rlc.transport_type = st.transport_type
  AND rlc.segment = 'china_to_transit'
WHERE sr.id IN (
  SELECT DISTINCT route_id FROM shipping_tiers
);
