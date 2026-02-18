-- ============================================================================
-- 📊 VER TODAS LAS TABLAS DE LOGÍSTICA - VERSIÓN SIMPLIFICADA
-- ============================================================================
-- Ejecuta este SQL completo para ver TODAS las tablas y columnas en un solo resultado

-- ============== RESUMEN COMPLETO EN UNA VISTA ==============
SELECT 
  'RESUMEN COMPLETO' as seccion,
  tabla,
  total_registros,
  activos,
  inactivos,
  porcentaje_activo
FROM (
  -- 1. Transit Hubs
  SELECT 
    'transit_hubs' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE is_active = true) as activos,
    COUNT(*) FILTER (WHERE is_active = false) as inactivos,
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1) as porcentaje_activo
  FROM transit_hubs
  
  UNION ALL
  
  -- 2. Destination Countries
  SELECT 
    'destination_countries',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM destination_countries
  
  UNION ALL
  
  -- 3. Shipping Routes
  SELECT 
    'shipping_routes',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM shipping_routes
  
  UNION ALL
  
  -- 4. Route Logistics Costs (Tramos)
  SELECT 
    'route_logistics_costs (TRAMOS)',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM route_logistics_costs
  
  UNION ALL
  
  -- 5. Shipping Tiers (Tipos de Envío)
  SELECT 
    'shipping_tiers (TIPOS)',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM shipping_tiers
  
  UNION ALL
  
  -- 6. Markets
  SELECT 
    'markets (MERCADOS)',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM markets
  
  UNION ALL
  
  -- 7. Category Shipping Rates (Tarifas)
  SELECT 
    'category_shipping_rates (TARIFAS)',
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false),
    ROUND((COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100), 1)
  FROM category_shipping_rates
) t
ORDER BY tabla;
