-- ============================================================================
-- 🛣️ VER DATOS DE RUTAS Y TRAMOS
-- ============================================================================

-- Ver TODAS las rutas con sus países y hubs
SELECT 
  'RUTAS' as seccion,
  sr.id,
  dc.name as pais_destino,
  dc.code as codigo_pais,
  th.name as hub_transito,
  CASE WHEN sr.is_direct THEN 'Sí' ELSE 'No' END as es_directo,
  CASE WHEN sr.is_active THEN '✅' ELSE '❌' END as activo,
  sr.created_at::date as fecha_creacion
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN transit_hubs th ON sr.transit_hub_id = th.id
ORDER BY sr.created_at DESC;
