-- =============================================================================
-- VERIFICACIÓN: Estructura de País de Destino y Direcciones de Usuario
-- =============================================================================
-- Script para verificar:
-- 1. Estructura de route_logistics_costs (destination_country_id)
-- 2. Estructura de tablas de usuario y dirección
-- 3. Relación user → address → destination_country
-- 4. Datos disponibles para la función

-- ============= 1️⃣ Estructura de route_logistics_costs =============

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 1️⃣.A Datos en route_logistics_costs =============

SELECT 
  id,
  destination_country_id,
  origin_country_id,
  segment,
  cost_per_kg,
  is_active,
  created_at
FROM public.route_logistics_costs
LIMIT 20;

-- ============= 2️⃣ Estructura de tabla: auth.users =============

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND table_schema = 'auth'
ORDER BY ordinal_position
LIMIT 20;

-- ============= 2️⃣.B Estructura de tabla: shipping_addresses =============

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_addresses'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= 2️⃣.C ¿Existe tabla destination_countries? =============

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'destination_countries'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver datos de países
SELECT 
  id,
  name,
  code,
  is_active,
  created_at
FROM public.destination_countries
LIMIT 20;

-- ============= 3️⃣ Relación: user │ shipping_address │ destination_country =============

-- Usuarios con direcciones
SELECT 
  u.id as user_id,
  u.email,
  sa.id as address_id,
  sa.destination_country_id,
  dc.name as pais_destino,
  dc.code as codigo_pais,
  sa.created_at
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
WHERE sa.id IS NOT NULL
LIMIT 20;

-- ============= 3️⃣.B Conteo de usuarios por país de destino =============

SELECT 
  dc.name as pais,
  dc.code,
  COUNT(DISTINCT u.id) as cantidad_usuarios,
  COUNT(DISTINCT sa.id) as cantidad_direcciones
FROM destination_countries dc
LEFT JOIN shipping_addresses sa ON dc.id = sa.destination_country_id
LEFT JOIN auth.users u ON sa.user_id = u.id
WHERE dc.is_active = TRUE
GROUP BY dc.id, dc.name, dc.code
ORDER BY cantidad_usuarios DESC;

-- ============= 4️⃣ Rutas disponibles por país =============

SELECT 
  dc.name as pais_destino,
  dc.code,
  COUNT(DISTINCT rlc.id) as cantidad_rutas,
  STRING_AGG(DISTINCT rlc.segment, ', ') as segmentos,
  MAX(rlc.created_at) as ultima_actualizacion
FROM destination_countries dc
LEFT JOIN route_logistics_costs rlc ON dc.id = rlc.destination_country_id
WHERE dc.is_active = TRUE
GROUP BY dc.id, dc.name, dc.code
ORDER BY cantidad_rutas DESC;

-- ============= 5️⃣ Tiers por ruta y país =============

SELECT 
  dc.name as pais_destino,
  dc.code,
  rlc.id as route_id,
  st.id as tier_id,
  st.tier_name,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.is_active,
  st.created_at
FROM destination_countries dc
JOIN route_logistics_costs rlc ON dc.id = rlc.destination_country_id
JOIN shipping_tiers st ON rlc.id = st.route_id
WHERE dc.is_active = TRUE
  AND st.is_active = TRUE
ORDER BY dc.name, st.tier_name;

-- ============= 6️⃣ Test: Obtener destination_country_id de usuario =============

WITH user_data AS (
  SELECT 
    u.id as user_id,
    u.email,
    sa.id as address_id,
    sa.destination_country_id,
    dc.name as pais_destino
  FROM auth.users u
  LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
  LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
  WHERE sa.id IS NOT NULL
  LIMIT 1
)
SELECT 
  user_id,
  email,
  address_id,
  destination_country_id,
  pais_destino,
  CASE 
    WHEN destination_country_id IS NOT NULL THEN '✅ País asignado'
    ELSE '❌ Sin país asignado'
  END as estado
FROM user_data;

-- ============= 7️⃣ Test: Llamar función con usuario real y producto =============

WITH user_address AS (
  SELECT 
    sa.destination_country_id
  FROM shipping_addresses sa
  WHERE sa.destination_country_id IS NOT NULL
  LIMIT 1
),
product_with_weight AS (
  SELECT 
    p.id
  FROM products p
  JOIN b2b_cart_items bci ON p.id = bci.product_id
  WHERE bci.peso_kg > 0
  LIMIT 1
)
SELECT 
  'Llamando función get_catalog_fastest_shipping_cost_by_product' as test,
  ua.destination_country_id,
  pw.id as product_id,
  'Si funciona verás resultado abajo' as nota
FROM user_address ua,
     product_with_weight pw;

-- ============= 8️⃣ DIAGNÓSTICO: Problemas comunes =============

-- ¿Hay rutas sin destination_country_id?
SELECT 
  'Rutas sin destination_country_id' as diagnostico,
  COUNT(*) as cantidad
FROM route_logistics_costs
WHERE destination_country_id IS NULL

UNION ALL

-- ¿Hay usuarios sin dirección?
SELECT 
  'Usuarios sin dirección',
  COUNT(DISTINCT u.id)
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
WHERE sa.id IS NULL

UNION ALL

-- ¿Hay direcciones sin país asignado?
SELECT 
  'Direcciones sin país',
  COUNT(*)
FROM shipping_addresses
WHERE destination_country_id IS NULL

UNION ALL

-- ¿Hay países no activos?
SELECT 
  'Países inactivos',
  COUNT(*)
FROM destination_countries
WHERE is_active = FALSE

UNION ALL

-- ¿Hay rutas no activas?
SELECT 
  'Rutas inactivas',
  COUNT(*)
FROM route_logistics_costs
WHERE is_active = FALSE;

-- ============= 9️⃣ RESUMEN: ¿Todo listo para la función? =============

SELECT 
  'route_logistics_costs.destination_country_id' as validacion,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name='route_logistics_costs' 
          AND column_name='destination_country_id') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as estado
  
UNION ALL

SELECT 
  'shipping_addresses.destination_country_id',
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name='shipping_addresses' 
          AND column_name='destination_country_id') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END

UNION ALL

SELECT 
  'destination_countries tabla',
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_name='destination_countries' AND table_schema='public') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END

UNION ALL

SELECT 
  'Rutas activas con país',
  CASE 
    WHEN (SELECT COUNT(*) FROM route_logistics_costs 
          WHERE destination_country_id IS NOT NULL 
          AND is_active = TRUE) > 0 
    THEN '✅ Sí hay rutas'
    ELSE '❌ NO hay rutas'
  END

UNION ALL

SELECT 
  'Usuarios con dirección y país',
  CASE 
    WHEN (SELECT COUNT(DISTINCT u.id) FROM auth.users u
          JOIN shipping_addresses sa ON u.id = sa.user_id
          WHERE sa.destination_country_id IS NOT NULL) > 0 
    THEN '✅ Sí hay usuarios'
    ELSE '❌ NO hay usuarios'
  END;
