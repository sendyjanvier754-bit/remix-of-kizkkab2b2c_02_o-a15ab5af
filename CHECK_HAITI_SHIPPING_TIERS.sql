-- Verificar la ruta de Haití y sus tiers
SELECT 
  'Ruta de Haití' as info,
  id,
  route_name,
  origin_country,
  destination_country,
  is_active
FROM public.shipping_routes
WHERE id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- Ver tiers configurados para esta ruta
SELECT 
  'Tiers para Haití' as info,
  st.id,
  st.tier_type,
  st.tier_name,
  st.custom_tier_name,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_cost_per_lb,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max,
  st.is_active
FROM public.shipping_tiers st
WHERE st.route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- Ver route_logistics_costs para esta ruta
SELECT 
  'Costos de logística para Haití' as info,
  id,
  origin_country,
  destination_country,
  transport_type,
  cost_per_kg,
  cost_per_lb,
  cost_per_cbm,
  min_cost,
  max_weight_kg,
  eta_days_min,
  eta_days_max,
  is_active
FROM public.route_logistics_costs
WHERE destination_country = 'Haiti' OR destination_country = 'Haití'
ORDER BY transport_type;
