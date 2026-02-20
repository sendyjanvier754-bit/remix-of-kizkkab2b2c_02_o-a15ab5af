-- =============================================================================
-- AUDITORÍA: Estado actual de la estructura logística
-- =============================================================================
-- Script para inventariar qué tablas, relaciones y datos ya existen

-- ============= 1️⃣ AUDITAR TABLAS EXISTENTES =============

SELECT 'TABLA ENCONTRADA' as tipo, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%market%'
    OR table_name LIKE '%pais%'
    OR table_name LIKE '%country%'
    OR table_name LIKE '%route%'
    OR table_name LIKE '%shipping%'
    OR table_name LIKE '%tramo%'
    OR table_name LIKE '%segment%'
    OR table_name LIKE '%envio%'
    OR table_name LIKE '%product%'
    OR table_name LIKE '%catalog%'
  )
ORDER BY table_name;

-- ============= 2️⃣ AUDITAR ESTRUCTURA: Tabla MARKETS =============

SELECT 'MARKETS' as tabla, COUNT(*) as registros, 
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'markets' AND table_schema = 'public'
GROUP BY table_name;

SELECT * FROM markets LIMIT 5;

-- ============= 3️⃣ AUDITAR ESTRUCTURA: Tabla COUNTRIES / DESTINATION_COUNTRIES =============

SELECT 'COUNTRIES' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE (table_name = 'countries' OR table_name = 'destination_countries') 
  AND table_schema = 'public'
GROUP BY table_name;

-- Ver datos
SELECT * FROM destination_countries LIMIT 5;

-- ============= 4️⃣ AUDITAR ESTRUCTURA: Tabla SHIPPING_ROUTES =============

SELECT 'SHIPPING_ROUTES' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'shipping_routes' AND table_schema = 'public'
GROUP BY table_name;

-- Ver datos y estructura
SELECT * FROM shipping_routes LIMIT 5;

-- ============= 5️⃣ AUDITAR ESTRUCTURA: Tabla ROUTE_LOGISTICS_COSTS =============

SELECT 'ROUTE_LOGISTICS_COSTS' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs' AND table_schema = 'public'
GROUP BY table_name;

SELECT * FROM route_logistics_costs LIMIT 5;

-- ============= 6️⃣ AUDITAR ESTRUCTURA: Tabla SHIPPING_TIERS =============

SELECT 'SHIPPING_TIERS' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' AND table_schema = 'public'
GROUP BY table_name;

SELECT * FROM shipping_tiers LIMIT 5;

-- ============= 7️⃣ AUDITAR ESTRUCTURA: Tabla SHIPPING_ADDRESSES =============

SELECT 'SHIPPING_ADDRESSES' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'shipping_addresses' AND table_schema = 'public'
GROUP BY table_name;

SELECT * FROM shipping_addresses LIMIT 5;

-- ============= 8️⃣ AUDITAR ESTRUCTURA: Tabla PRODUCTS =============

SELECT 'PRODUCTS' as tabla, COUNT(*) as registros,
       STRING_AGG(column_name, ', ') as columnas
FROM information_schema.columns
WHERE table_name = 'products' AND table_schema = 'public'
GROUP BY table_name;

-- ============= 9️⃣ AUDITAR FOREIGN KEYS =============

SELECT 
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
  AND referenced_table_name IS NOT NULL
  AND (
    table_name LIKE '%route%'
    OR table_name LIKE '%shipping%'
    OR table_name LIKE '%pais%'
    OR table_name LIKE '%country%'
    OR table_name LIKE '%market%'
    OR table_name LIKE '%address%'
    OR table_name LIKE '%product%'
  )
ORDER BY table_name, column_name;

-- ============= 🔟 AUDITAR RELACIONES ACTUALES =============

-- Relación: Markets → Countries
SELECT 
  'Markets' as tabla_origen,
  COUNT(DISTINCT market_id) as mercados,
  COUNT(DISTINCT destination_country_id) as paises
FROM destination_countries
WHERE market_id IS NOT NULL;

-- Relación: Countries → Routes
SELECT 
  'Destination Countries' as tabla_origen,
  COUNT(DISTINCT dc.id) as paises,
  COUNT(DISTINCT sr.id) as rutas
FROM destination_countries dc
LEFT JOIN shipping_routes sr ON dc.id = sr.destination_country_id;

-- Relación: Routes → Tiers
SELECT 
  'Shipping Routes' as tabla_origen,
  COUNT(DISTINCT sr.id) as rutas,
  COUNT(DISTINCT st.id) as tiers
FROM shipping_routes sr
LEFT JOIN shipping_tiers st ON sr.id = st.route_id;

-- ============= 1️⃣1️⃣ AUDITAR COBERTURA DE MERCADO-PAÍS-ENVÍO =============

SELECT 
  COALESCE(m.name, 'SIN MERCADO') as mercado,
  COALESCE(dc.name, 'SIN PAÍS') as pais,
  COUNT(DISTINCT sr.id) as cantidad_rutas,
  COUNT(DISTINCT st.id) as cantidad_tiers,
  STRING_AGG(DISTINCT st.tier_name, ' | ') as tipos_envio
FROM destination_countries dc
LEFT JOIN markets m ON dc.market_id = m.id
LEFT JOIN shipping_routes sr ON dc.id = sr.destination_country_id
LEFT JOIN shipping_tiers st ON sr.id = st.route_id AND st.is_active = TRUE
GROUP BY m.id, m.name, dc.id, dc.name
ORDER BY mercado, pais;

-- ============= 1️⃣2️⃣ AUDITAR USUARIOS Y DIRECCIONES =============

SELECT 
  'Usuarios totales' as auditoria,
  COUNT(DISTINCT u.id) as cantidad
FROM auth.users u

UNION ALL

SELECT 
  'Usuarios con dirección',
  COUNT(DISTINCT u.id)
FROM auth.users u
JOIN shipping_addresses sa ON u.id = sa.user_id

UNION ALL

SELECT 
  'Direcciones totales',
  COUNT(*)
FROM shipping_addresses

UNION ALL

SELECT 
  'Direcciones con país',
  COUNT(*)
FROM shipping_addresses
WHERE destination_country_id IS NOT NULL;

-- ============= 1️⃣3️⃣ AUDITAR PRODUCTOS Y STOCK =============

SELECT 
  'Productos totales' as auditoria,
  COUNT(*) as cantidad
FROM products

UNION ALL

SELECT 
  'Productos con peso (en carrito)',
  COUNT(DISTINCT product_id)
FROM b2b_cart_items
WHERE peso_kg > 0;

-- ============= 1️⃣4️⃣ AUDITAR CONSISTENCIA: País en dirección vs País en ruta =============

SELECT 
  sa.destination_country_id as pais_usuario,
  COUNT(DISTINCT u.id) as usuarios,
  COUNT(DISTINCT sr.id) as rutas_disponibles,
  CASE 
    WHEN COUNT(DISTINCT sr.id) > 0 THEN '✅ Tiene rutas'
    ELSE '❌ NO tiene rutas'
  END as estado
FROM shipping_addresses sa
LEFT JOIN auth.users u ON sa.user_id = u.id
LEFT JOIN shipping_routes sr ON sa.destination_country_id = sr.destination_country_id 
                                AND sr.is_active = TRUE
WHERE sa.destination_country_id IS NOT NULL
GROUP BY sa.destination_country_id
ORDER BY usuarios DESC;

-- ============= 1️⃣5️⃣ AUDITAR MISSING LINKS: Qué no está conectado? =============

-- Countries sin mercado
SELECT 'Countries SIN mercado asignado' as problema, COUNT(*) as cantidad
FROM destination_countries
WHERE market_id IS NULL

UNION ALL

-- Countries sin rutas
SELECT 'Countries SIN rutas',
      COUNT(*)
FROM destination_countries dc
LEFT JOIN shipping_routes sr ON dc.id = sr.destination_country_id
WHERE sr.id IS NULL

UNION ALL

-- Routes sin tiers
SELECT 'Routes SIN tiers',
      COUNT(*)
FROM shipping_routes sr
LEFT JOIN shipping_tiers st ON sr.id = st.route_id AND st.is_active = TRUE
WHERE st.id IS NULL

UNION ALL

-- Shipping_addresses sin país
SELECT 'Direcciones SIN país',
      COUNT(*)
FROM shipping_addresses
WHERE destination_country_id IS NULL

UNION ALL

-- Tiers sin tramos (segments)
SELECT 'Tiers SIN tramos',
      COUNT(*)
FROM shipping_tiers st
LEFT JOIN route_logistics_costs rlc ON st.route_id = rlc.shipping_route_id
WHERE rlc.id IS NULL
OR rlc.shipping_route_id IS NULL;
