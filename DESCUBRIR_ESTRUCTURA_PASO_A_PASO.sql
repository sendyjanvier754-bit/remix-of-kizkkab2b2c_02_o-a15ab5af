-- =============================================================================
-- SCRIPT DE DESCUBRIMIENTO: Encontrar la estructura sin errores
-- =============================================================================
-- Ejecuta esto paso a paso - copia cada sección (entre los === )

-- ============= PASO 1: Listar TODAS las tablas relacionadas =============

SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%route%' OR table_name LIKE '%address%' OR table_name LIKE '%destination%'
  OR table_name LIKE '%shipping%' OR table_name LIKE '%cart%'
ORDER BY table_name;

/*
RESULTADO ESPERADO: Aquí vemos qué tablas existen
Ej: shipping_routes, shipping_addresses, destination_countries, etc.
*/

-- ============= PASO 2: Ver estructura de cada tabla =============
-- EJECUTA CADA UNA SEPARADA (una queries por línea)

-- Tabla: route_logistics_costs
\d route_logistics_costs

-- Tabla: shipping_routes  
\d shipping_routes

-- Tabla: shipping_addresses
\d shipping_addresses

-- Tabla: destination_countries
\d destination_countries

-- Tabla: b2b_carts
\d b2b_carts

-- ============= PASO 3 (ALTERNATIVO): Si arriba no funciona, usa esto =============

-- route_logistics_costs
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='route_logistics_costs' ORDER BY ordinal_position;

-- shipping_routes
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='shipping_routes' ORDER BY ordinal_position;

-- shipping_addresses
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='shipping_addresses' ORDER BY ordinal_position;

-- b2b_carts
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='b2b_carts' ORDER BY ordinal_position;

-- destination_countries
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='destination_countries' ORDER BY ordinal_position;

-- ============= PASO 4: Ver ejemplo de datos (sin columnas específicas) =============

-- De route_logistics_costs
SELECT * FROM route_logistics_costs LIMIT 1;

-- De shipping_routes
SELECT * FROM shipping_routes LIMIT 1;

-- De shipping_addresses (si existe)
SELECT * FROM shipping_addresses LIMIT 1;

-- De b2b_carts
SELECT * FROM b2b_carts LIMIT 1;

-- ============= PASO 5: Foreign Keys - ver relaciones =============

SELECT 
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema='public'
  AND (table_name LIKE '%route%' OR table_name LIKE '%address%' 
       OR table_name LIKE '%destination%' OR table_name LIKE '%cart%')
ORDER BY table_name, column_name;
