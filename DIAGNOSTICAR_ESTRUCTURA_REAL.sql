-- =============================================================================
-- DIAGNÓSTICO: Descubrir la estructura REAL de las tablas
-- =============================================================================
-- Este script NO asume nada, solo muestra qué existe realmente

-- ============= 1️⃣ ¿Qué columnas tiene route_logistics_costs? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 2️⃣ ¿Qué columnas tiene shipping_addresses? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shipping_addresses'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 3️⃣ ¿Qué columnas tiene shipping_routes? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shipping_routes'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 4️⃣ ¿Qué columnas tiene destination_countries? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'destination_countries'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 5️⃣ ¿Qué columnas tiene b2b_carts? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'b2b_carts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 6️⃣ Ver datos reales de route_logistics_costs =============

SELECT * FROM route_logistics_costs LIMIT 5;

-- ============= 7️⃣ Ver datos reales de shipping_routes =============

SELECT * FROM shipping_routes LIMIT 5;

-- ============= 8️⃣ Ver datos reales de shipping_addresses =============

SELECT * FROM shipping_addresses LIMIT 5;

-- ============= 9️⃣ Ver datos reales de destination_countries =============

SELECT * FROM destination_countries LIMIT 5;

-- ============= 🔟 Los carritos tienen ruta? =============

SELECT * FROM b2b_carts LIMIT 5;
