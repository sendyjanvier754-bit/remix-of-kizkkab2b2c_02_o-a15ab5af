-- Check shipping_routes
SELECT COUNT(*) as routes_count, COUNT(CASE WHEN is_active = true THEN 1 END) as active_routes FROM shipping_routes;
SELECT * FROM shipping_routes LIMIT 5;

-- Check shipping_zones  
SELECT COUNT(*) as zones_count, COUNT(CASE WHEN is_active = true THEN 1 END) as active_zones FROM shipping_zones;
SELECT * FROM shipping_zones LIMIT 5;

-- Check shipping_types_per_route
SELECT COUNT(*) FROM shipping_types_per_route LIMIT 5;

-- Check v_logistics_data
SELECT COUNT(*) FROM v_logistics_data LIMIT 1;
SELECT * FROM v_logistics_data LIMIT 3;
