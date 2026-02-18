-- ============================================================================
-- 📋 VER TODAS LAS COLUMNAS DE LAS TABLAS DE LOGÍSTICA
-- ============================================================================
-- Muestra TODAS las columnas de cada tabla en un solo resultado

SELECT 
  table_name as tabla,
  column_name as columna,
  data_type as tipo,
  is_nullable as permite_null,
  ordinal_position as orden,
  CASE 
    WHEN column_name LIKE '%_id' AND column_name != 'id' THEN '🔗 Foreign Key'
    WHEN column_name = 'id' THEN '🔑 Primary Key'
    WHEN column_name = 'is_active' THEN '✅ Estado'
    WHEN column_name IN ('created_at', 'updated_at') THEN '🕒 Timestamp'
    WHEN column_name LIKE '%cost%' OR column_name LIKE '%price%' OR column_name LIKE '%fee%' THEN '💰 Dinero'
    WHEN column_name LIKE '%name%' OR column_name LIKE '%code%' THEN '📝 Identificador'
    ELSE ''
  END as tipo_campo
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'transit_hubs',
    'destination_countries',
    'shipping_routes',
    'route_logistics_costs',
    'shipping_tiers',
    'markets',
    'category_shipping_rates'
  )
ORDER BY 
  CASE table_name
    WHEN 'transit_hubs' THEN 1
    WHEN 'destination_countries' THEN 2
    WHEN 'shipping_routes' THEN 3
    WHEN 'route_logistics_costs' THEN 4
    WHEN 'shipping_tiers' THEN 5
    WHEN 'markets' THEN 6
    WHEN 'category_shipping_rates' THEN 7
  END,
  ordinal_position;
