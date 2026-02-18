-- ============================================================================
-- CALCULAR COSTO PARA 1 KG CON EXPRESS AÉREO
-- ============================================================================

SELECT 
  COALESCE(st.custom_tier_name, st.tier_name) as "Tier",
  st.transport_type as "Transporte",
  st.tramo_a_cost_per_kg as "Tramo A ($/kg)",
  st.tramo_b_cost_per_kg as "Tramo B ($/kg)",
  csc.weight_rounded_kg as "Peso (kg)",
  csc.base_cost as "Costo Base ($)",
  csc.extra_cost as "Extras ($)",
  csc.total_cost_with_type as "TOTAL ($)"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(
    1.0,      -- 1kg
    st.id,
    FALSE,
    NULL, NULL, NULL
  )
) csc
WHERE st.transport_type = 'aereo'
  AND st.tier_name LIKE '%Express%'
  AND st.is_active = TRUE;

-- ============================================================================
-- CÁLCULO MANUAL ESPERADO:
-- ============================================================================
-- Peso: 1kg → CEIL(1) = 1kg
-- Tramo A: 1 × $7.00 = $7.00
-- Tramo B: 1 × $5.00 = $5.00
-- TOTAL: $12.00 ✅
-- ============================================================================
