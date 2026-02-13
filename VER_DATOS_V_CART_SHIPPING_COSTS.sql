-- =============================================================================
-- CONSULTA SIMPLE: Ver todos los datos de v_cart_shipping_costs
-- Fecha: 2026-02-12
-- =============================================================================

-- Ver todos los datos de la vista
SELECT 
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  route_id,
  shipping_type_id,
  calculated_weight_rounded_kg,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  volume_m3,
  extra_cost,
  shipping_type_name,
  shipping_type_display,
  total_cost_with_type,
  last_updated
FROM v_cart_shipping_costs;

-- =============================================================================
-- RESULTADO ESPERADO:
-- - 1 fila con datos del carrito simulado (10 productos activos)
-- - total_items = 10
-- - total_weight_kg = suma de pesos de los 10 productos
-- - base_cost > 0
-- - total_cost_with_type > 0
-- - shipping_type_name = 'STANDARD'
-- =============================================================================
