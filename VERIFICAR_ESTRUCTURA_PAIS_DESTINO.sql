-- =============================================================================
-- VERIFICACIÓN: Estructura de País de Destino y Direcciones de Usuario
-- =============================================================================
-- Script para verificar:
-- 1. Estructura de route_logistics_costs (destination_country_id)
-- 2. Estructura de tablas de usuario y dirección
-- 3. Relación user → address → destination_country
-- 4. Datos disponibles para la función

-- =============================================================================
-- 1️⃣ VERIFICAR: route_logistics_costs tiene destination_country_id
-- =============================================================================
-- Estructura de ruta_logistics_costs

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Si existe destination_country_id: mostrar datos
-- Datos en route_logistics_costs (con destination_country_id)

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

---

-- =============================================================================
-- 2️⃣ VERIFICAR: Estructura de tablas de usuario y dirección
-- =============================================================================
-- Estructura de tabla: users / auth.users

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE (table_name = 'users' OR table_name = 'profiles')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

;

-- Estructura de tabla: addresses / shipping_addresses

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name LIKE '%address%'
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

;

-- ¿Existe tabla destination_countries?

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'destination_countries'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Mostrar datos de países
SELECT 
  id,
  name,
  code,
  is_active,
  created_at
FROM public.destination_countries
LIMIT 20;

;

-- =============================================================================
-- 3️⃣ RELACIONES: user → address → destination_country
-- =============================================================================
-- Relación: user → shipping_address → destination_country_id

-- Ejemplo 1: Ver usuarios con direcciones
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
WHERE sa.id IS NOT NULL  -- Solo usuarios con dirección
LIMIT 20;

;

-- Ejemplo 2: Conteo de usuarios por país de destino

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

;

-- =============================================================================
-- 4️⃣ VERIFICAR: Rutas disponibles por país
-- =============================================================================
-- Rutas disponibles (route_logistics_costs) por país

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

;

-- =============================================================================
-- 5️⃣ VERIFICAR: Relación entre tier y ruta
-- =============================================================================
-- Tiers por ruta y país

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

;

-- =============================================================================
-- 6️⃣ TEST: Simular llamada a función con usuario real
-- =============================================================================
-- Test: Obtener destination_country_id de usuario actual

-- Reemplaza 'user-uuid-aqui' con un UUID de usuario real
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
  WHERE sa.id IS NOT NULL  -- Solo usuarios con dirección asignada
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

;

-- =============================================================================
-- 7️⃣ TEST: Llamar función con usuario real y producto
-- =============================================================================
-- Test: Llamar función get_catalog_fastest_shipping_cost_by_product

-- Obtener un usuario con dirección y un producto con peso
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
  cps.product_id,
  cps.total_weight_kg,
  cps.weight_rounded_kg,
  cps.fastest_shipping_tier,
  cps.fastest_shipping_cost_usd,
  cps.destination_country_id,
  cps.formula_description
FROM user_address ua,
     product_with_weight pw,
     public.get_catalog_fastest_shipping_cost_by_product(pw.id, ua.destination_country_id) cps
LIMIT 1;

-- =============================================================================
-- 8️⃣ DIAGNÓSTICO: Problemas comunes
-- =============================================================================
-- Diagnóstico: Verificar problemas comunes

-- Problema 1: ¿Hay rutas sin destination_country_id?
SELECT 
  COUNT(*) as rutas_sin_pais
FROM route_logistics_costs
WHERE destination_country_id IS NULL;

-- Problema 2: ¿Hay usuarios sin dirección?
SELECT 
  COUNT(DISTINCT u.id) as usuarios_sin_direccion
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
WHERE sa.id IS NULL;

-- Problema 3: ¿Hay direcciones sin país asignado?
SELECT 
  COUNT(*) as direcciones_sin_pais
FROM shipping_addresses
WHERE destination_country_id IS NULL;

-- Problema 4: ¿Hay países no activos?
SELECT 
  COUNT(*) as paises_inactivos
FROM destination_countries
WHERE is_active = FALSE;

-- Problema 5: ¿Hay rutas no activas?
SELECT 
  COUNT(*) as rutas_inactivas
FROM route_logistics_costs
WHERE is_active = FALSE;

;

-- =============================================================================
-- 9️⃣ RESUMEN FINAL
-- =============================================================================
-- RESUMEN: ¿Todo listo para la función?

SELECT 
  '✅ route_logistics_costs.destination_country_id' as item,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name='route_logistics_costs' 
          AND column_name='destination_country_id') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as estado
UNION ALL
SELECT 
  '✅ shipping_addresses.destination_country_id' as item,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name='shipping_addresses' 
          AND column_name='destination_country_id') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as estado
UNION ALL
SELECT 
  '✅ destination_countries tabla' as item,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_name='destination_countries') > 0 
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as estado
UNION ALL
SELECT 
  '✅ Rutas activas con país' as item,
  CASE 
    WHEN (SELECT COUNT(*) FROM route_logistics_costs 
          WHERE destination_country_id IS NOT NULL 
          AND is_active = TRUE) > 0 
    THEN '✅ Sí hay ' || (SELECT COUNT(*) FROM route_logistics_costs 
                          WHERE destination_country_id IS NOT NULL 
                          AND is_active = TRUE)::TEXT
    ELSE '❌ NO hay'
  END as estado
UNION ALL
SELECT 
  '✅ Usuarios con dirección y país' as item,
  CASE 
    WHEN (SELECT COUNT(DISTINCT u.id) FROM auth.users u
          JOIN shipping_addresses sa ON u.id = sa.user_id
          WHERE sa.destination_country_id IS NOT NULL) > 0 
    THEN '✅ Sí hay ' || (SELECT COUNT(DISTINCT u.id) FROM auth.users u
                          JOIN shipping_addresses sa ON u.id = sa.user_id
                          WHERE sa.destination_country_id IS NOT NULL)::TEXT
    ELSE '❌ NO hay'
  END as estado;

---

-- =============================================================================
-- 🔧 COMANDOS ÚTILES PARA DEBUGGING
-- =============================================================================

/*

-- Ver un usuario específico con su dirección
SELECT 
  u.id,
  u.email,
  sa.id as address_id,
  sa.destination_country_id,
  dc.name as pais
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
WHERE u.email = 'tu-email@ejemplo.com';

-- Ver un producto con peso en carrito
SELECT 
  p.id,
  p.name,
  SUM(bci.peso_kg * bci.quantity) as total_weight
FROM products p
JOIN b2b_cart_items bci ON p.id = bci.product_id
WHERE p.name LIKE '%Laptop%'
GROUP BY p.id, p.name;

-- Llamar función con valores específicos
SELECT *
FROM public.get_catalog_fastest_shipping_cost_by_product(
  'product-uuid-aqui',
  'country-uuid-aqui'
);

*/
