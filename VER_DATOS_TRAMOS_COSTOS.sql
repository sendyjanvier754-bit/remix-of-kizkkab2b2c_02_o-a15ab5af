-- ============================================================================
-- 📦 VER DATOS DE TRAMOS (COSTOS LOGÍSTICOS)
-- ============================================================================

-- Ver TODOS los tramos con sus costos
SELECT 
  'TRAMOS' as seccion,
  rlc.id,
  dc.name as pais_destino,
  CASE rlc.segment
    WHEN 'china_to_transit' THEN '📤 Tramo A (China → Hub)'
    WHEN 'transit_to_destination' THEN '📥 Tramo B (Hub → Destino)'
    WHEN 'china_to_destination' THEN '✈️ Directo'
    ELSE rlc.segment
  END as tramo,
  rlc.cost_per_kg as costo_kg,
  rlc.min_cost as costo_minimo,
  rlc.estimated_days_min || '-' || rlc.estimated_days_max || ' días' as tiempo_estimado,
  CASE WHEN rlc.is_active THEN '✅' ELSE '❌' END as activo
FROM route_logistics_costs rlc
LEFT JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
ORDER BY dc.name, rlc.segment;
