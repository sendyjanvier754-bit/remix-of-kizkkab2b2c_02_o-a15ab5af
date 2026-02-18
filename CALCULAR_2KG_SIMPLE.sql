-- ============================================================================
-- CÁLCULO SIMPLE PARA 2 KG - RESULTADOS EN TABLA
-- ============================================================================

WITH peso_info AS (
  SELECT 
    2.0 as peso_original_kg,
    CEIL(2.0) as peso_redondeado_kg,
    CEIL(2.0) * 2.20462 as peso_lb
),
calculos AS (
  SELECT 
    st.tier_name,
    st.custom_tier_name,
    st.transport_type,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb,
    p.peso_redondeado_kg,
    p.peso_lb,
    -- Tramo A (en kg)
    (p.peso_redondeado_kg * st.tramo_a_cost_per_kg) as costo_tramo_a,
    -- Tramo B (en lb)
    (p.peso_lb * st.tramo_b_cost_per_lb) as costo_tramo_b,
    -- Total
    (p.peso_redondeado_kg * st.tramo_a_cost_per_kg) + (p.peso_lb * st.tramo_b_cost_per_lb) as total_calculado
  FROM shipping_tiers st
  CROSS JOIN peso_info p
  WHERE st.is_active = TRUE
)
SELECT 
  COALESCE(custom_tier_name, tier_name) as "Tier",
  transport_type as "Transporte",
  peso_redondeado_kg as "Peso (kg)",
  ROUND(peso_lb, 2) as "Peso (lb)",
  '$' || tramo_a_cost_per_kg || '/kg' as "Tarifa Tramo A",
  '$' || tramo_b_cost_per_lb || '/lb' as "Tarifa Tramo B",
  ROUND(costo_tramo_a, 2) as "Costo Tramo A ($)",
  ROUND(costo_tramo_b, 2) as "Costo Tramo B ($)",
  ROUND(total_calculado, 2) as "TOTAL ($)"
FROM calculos
ORDER BY transport_type, tier_name;

-- ============================================================================
-- VERIFICAR CON LA FUNCIÓN REAL
-- ============================================================================

SELECT 
  COALESCE(st.custom_tier_name, st.tier_name) as "Tier",
  st.transport_type as "Transporte",
  csc.weight_rounded_kg as "Peso Redondeado (kg)",
  csc.base_cost as "Costo Base ($)",
  csc.extra_cost as "Extras ($)",
  csc.total_cost_with_type as "TOTAL FUNCIÓN ($)"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(
    2.0,      -- peso
    st.id,    -- tier_id
    FALSE,    -- oversize
    NULL, NULL, NULL  -- dimensiones
  )
) csc
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;
