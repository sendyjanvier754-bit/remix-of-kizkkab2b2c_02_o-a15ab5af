-- =============================================================================
-- VER ESTRUCTURA REAL DE shipping_routes
-- =============================================================================

-- 1. Ver columnas de shipping_routes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_routes'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver un registro de ejemplo
SELECT *
FROM shipping_routes
WHERE id = '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
LIMIT 1;

-- 3. Ver todos los datos de la ruta CHINA → HT
SELECT 
  sr.*,
  th.name as hub_name,
  th.code as hub_code,
  dc.name as country_name,
  dc.code as country_code
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT';
