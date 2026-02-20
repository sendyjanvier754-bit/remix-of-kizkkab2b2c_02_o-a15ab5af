-- =============================================================================
-- SCRIPT EJECUTABLE: Verificar estructura y mostrar datos reales
-- =============================================================================
-- Este script hace verificaciones REALES y muestra datos de tu base de datos

-- =============================================================================
-- 1️⃣ VERIFICAR COLUMNAS NECESARIAS
-- =============================================================================

SECTION 'Paso 1: ¿Existen las columnas necesarias?', 'blue';

-- Verificar destination_countries
SELECT 
  'destination_countries' as tabla,
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'destination_countries' 
    AND table_schema = 'public'
  ) as existe,
  (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'destination_countries'
    AND table_schema = 'public'
  )::TEXT as columnas
UNION ALL
-- Verificar shipping_addresses
SELECT 
  'shipping_addresses',
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'shipping_addresses'
    AND table_schema = 'public'
  ),
  (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'shipping_addresses'
    AND table_schema = 'public'
  )::TEXT
UNION ALL
-- Verificar route_logistics_costs
SELECT 
  'route_logistics_costs',
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'route_logistics_costs'
    AND table_schema = 'public'
  ),
  (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'route_logistics_costs'
    AND table_schema = 'public'
  )::TEXT
UNION ALL
-- Verificar shipping_tiers
SELECT 
  'shipping_tiers',
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'shipping_tiers'
    AND table_schema = 'public'
  ),
  (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'shipping_tiers'
    AND table_schema = 'public'
  )::TEXT;

---

-- =============================================================================
-- 2️⃣ VERIFICAR COLUMNAS destination_country_id
-- =============================================================================

SECTION 'Paso 2: ¿Existen las columnas destination_country_id?', 'green';

-- En shipping_addresses
SELECT 
  'shipping_addresses.destination_country_id' as columna,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'shipping_addresses'
      AND column_name = 'destination_country_id'
      AND table_schema = 'public'
    ) THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as estado
UNION ALL
-- En route_logistics_costs
SELECT 
  'route_logistics_costs.destination_country_id',
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'route_logistics_costs'
      AND column_name = 'destination_country_id'
      AND table_schema = 'public'
    ) THEN '✅ Existe'
    ELSE '❌ NO existe'
  END;

---

-- =============================================================================
-- 3️⃣ CONTAR REGISTROS EN CADA TABLA
-- =============================================================================

SECTION 'Paso 3: Cantidad de registros', 'yellow';

SELECT 'destination_countries' as tabla, COUNT(*) as registros FROM destination_countries
UNION ALL
SELECT 'shipping_addresses', COUNT(*) FROM shipping_addresses
UNION ALL
SELECT 'route_logistics_costs', COUNT(*) FROM route_logistics_costs
UNION ALL
SELECT 'shipping_tiers', COUNT(*) FROM shipping_tiers
UNION ALL
SELECT 'b2b_cart_items', COUNT(*) FROM b2b_cart_items
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

---

-- =============================================================================
-- 4️⃣ VER DATOS: destination_countries
-- =============================================================================

SECTION 'Paso 4: Países disponibles (destination_countries)', 'cyan';

SELECT 
  id,
  name,
  code,
  is_active,
  created_at
FROM destination_countries
ORDER BY is_active DESC, created_at DESC
LIMIT 20;

---

-- =============================================================================
-- 5️⃣ VER DATOS: Usuarios con dirección
-- =============================================================================

SECTION 'Paso 5: Usuarios con dirección y país', 'magenta';

SELECT 
  u.id as user_id,
  u.email,
  sa.id as address_id,
  sa.destination_country_id,
  dc.name as pais,
  dc.code as codigo,
  sa.is_default,
  sa.created_at
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
WHERE sa.id IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 30;

---

-- =============================================================================
-- 6️⃣ VER DATOS: Rutas por país
-- =============================================================================

SECTION 'Paso 6: Rutas disponibles por país (route_logistics_costs)', 'blue';

SELECT 
  dc.name as pais,
  dc.code,
  dc.id as country_id,
  COUNT(DISTINCT rlc.id) as cantidad_rutas,
  MAX(CASE WHEN rlc.is_active = TRUE THEN 1 ELSE 0 END) as tiene_rutas_activas,
  STRING_AGG(DISTINCT rlc.segment, ', ') as segmentos
FROM destination_countries dc
LEFT JOIN route_logistics_costs rlc ON dc.id = rlc.destination_country_id
GROUP BY dc.id, dc.name, dc.code
ORDER BY cantidad_rutas DESC;

---

-- =============================================================================
-- 7️⃣ VER DATOS: Tiers por ruta
-- =============================================================================

SECTION 'Paso 7: Tiers en rutas (shipping_tiers)', 'red';

SELECT 
  dc.name as pais,
  rlc.id as route_id,
  st.id as tier_id,
  st.tier_name,
  st.custom_tier_name,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.is_active,
  CASE 
    WHEN LOWER(st.tier_name) = 'express' THEN '🚀 EXPRESS'
    WHEN LOWER(st.tier_name) = 'fast' THEN '⚡ FAST'
    ELSE '📦 Standard'
  END as velocidad
FROM destination_countries dc
JOIN route_logistics_costs rlc ON dc.id = rlc.destination_country_id
JOIN shipping_tiers st ON rlc.id = st.route_id
WHERE dc.is_active = TRUE AND st.is_active = TRUE
ORDER BY dc.name, st.tier_name
LIMIT 50;

---

-- =============================================================================
-- 8️⃣ VER DATOS: Productos en carrito
-- =============================================================================

SECTION 'Paso 8: Productos en carrito con peso', 'orange';

SELECT 
  p.id as product_id,
  p.name as product_name,
  SUM(bci.peso_kg * bci.quantity) as total_weight_kg,
  COUNT(DISTINCT bci.cart_id) as carts,
  SUM(bci.quantity) as items
FROM products p
JOIN b2b_cart_items bci ON p.id = bci.product_id
WHERE bci.peso_kg > 0
GROUP BY p.id, p.name
ORDER BY total_weight_kg DESC
LIMIT 30;

---

-- =============================================================================
-- 9️⃣ RELACIÓN FINAL: Usuario → País → Ruta → Costo
-- =============================================================================

SECTION 'Paso 9: Relación completa concreto (ej: un usuario)', 'green';

-- Obtener un usuario con dirección
WITH selected_user AS (
  SELECT u.id, u.email, sa.destination_country_id
  FROM auth.users u
  JOIN shipping_addresses sa ON u.id = sa.user_id
  WHERE sa.destination_country_id IS NOT NULL
  LIMIT 1
),
user_info AS (
  SELECT 
    su.id as user_id,
    su.email,
    su.destination_country_id,
    dc.name as pais,
    dc.code
  FROM selected_user su
  LEFT JOIN destination_countries dc ON su.destination_country_id = dc.id
),
route_info AS (
  SELECT 
    ui.user_id,
    ui.email,
    ui.pais,
    ui.code,
    ui.destination_country_id,
    rlc.id as route_id,
    COUNT(st.id) as cantidad_tiers
  FROM user_info ui
  LEFT JOIN route_logistics_costs rlc ON ui.destination_country_id = rlc.destination_country_id
  LEFT JOIN shipping_tiers st ON rlc.id = st.route_id AND st.is_active = TRUE
  GROUP BY ui.user_id, ui.email, ui.pais, ui.code, ui.destination_country_id, rlc.id
)
SELECT 
  user_id,
  email,
  pais,
  code,
  destination_country_id,
  route_id,
  cantidad_tiers,
  CASE 
    WHEN route_id IS NOT NULL AND cantidad_tiers > 0 THEN '✅ LISTA PARA FUNCIÓN'
    WHEN route_id IS NULL THEN '❌ Sin ruta para este país'
    ELSE '❌ La ruta no tiene tiers'
  END as estado
FROM route_info;

---

-- =============================================================================
-- 🔟 LLAMAR LA FUNCIÓN CON DATOS REALES
-- =============================================================================

SECTION 'Paso 10: Prueba real de la función', 'white';

/*
Si todos los pasos anteriores muestran ✅, ejecuta esto:
*/

-- Obtener valores reales
WITH real_data AS (
  SELECT 
    DISTINCT ON (u.id)
    u.id as user_id,
    sa.destination_country_id,
    p.id as product_id
  FROM auth.users u
  JOIN shipping_addresses sa ON u.id = sa.user_id
  JOIN b2b_cart_items bci ON TRUE  -- Cualquier producto con peso
  JOIN products p ON bci.product_id = p.id
  WHERE sa.destination_country_id IS NOT NULL
    AND bci.peso_kg > 0
  LIMIT 1
)
SELECT 
  'LLAMADA A FUNCIÓN' as operacion,
  rd.user_id,
  rd.destination_country_id,
  rd.product_id,
  cfs.product_id as result_product_id,
  cfs.total_weight_kg,
  cfs.fastest_shipping_tier,
  cfs.fastest_shipping_cost_usd,
  CASE 
    WHEN cfs.product_id IS NOT NULL THEN '✅ FUNCIÓN FUNCIONÓ'
    ELSE '❌ Sin resultado'
  END as resultado
FROM real_data rd
LEFT JOIN LATERAL public.get_catalog_fastest_shopping_cost_by_product(
  rd.product_id,
  rd.destination_country_id
) cfs ON TRUE;

---

-- =============================================================================
-- 1️⃣1️⃣ RESUMEN Y RECOMENDACIONES
-- =============================================================================

SECTION 'Resumen: ¿Está todo listo?', 'red';

WITH status_check AS (
  SELECT 
    '1. Tabla destination_countries existe' as check_item,
    CASE 
      WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='destination_countries') 
      THEN '✅'
      ELSE '❌'
    END as status
  UNION ALL
  SELECT 
    '2. Tabla shipping_addresses existe',
    CASE 
      WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='shipping_addresses') 
      THEN '✅'
      ELSE '❌'
    END
  UNION ALL
  SELECT 
    '3. route_logistics_costs.destination_country_id existe',
    CASE 
      WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='route_logistics_costs' 
        AND column_name='destination_country_id'
      ) THEN '✅'
      ELSE '❌'
    END
  UNION ALL
  SELECT 
    '4. shipping_addresses.destination_country_id existe',
    CASE 
      WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='shipping_addresses' 
        AND column_name='destination_country_id'
      ) THEN '✅'
      ELSE '❌'
    END
  UNION ALL
  SELECT 
    '5. Hay usuarios con dirección y país',
    CASE 
      WHEN EXISTS(
        SELECT 1 FROM auth.users u
        JOIN shipping_addresses sa ON u.id = sa.user_id
        WHERE sa.destination_country_id IS NOT NULL
      ) THEN '✅'
      ELSE '❌'
    END
  UNION ALL
  SELECT 
    '6. Hay rutas para esos países',
    CASE 
      WHEN EXISTS(
        SELECT 1 FROM route_logistics_costs 
        WHERE destination_country_id IS NOT NULL AND is_active = TRUE
      ) THEN '✅'
      ELSE '❌'
    END
  UNION ALL
  SELECT 
    '7. Hay tiers en esas rutas',
    CASE 
      WHEN EXISTS(
        SELECT 1 FROM shipping_tiers 
        WHERE is_active = TRUE
        AND route_id IN (
          SELECT id FROM route_logistics_costs 
          WHERE destination_country_id IS NOT NULL
        )
      ) THEN '✅'
      ELSE '❌'
    END
)
SELECT * FROM status_check ORDER BY check_item;

---

-- =============================================================================
-- RECOMENDACIONES SI HAY PROBLEMAS
-- =============================================================================

/*

❌ SI VES "❌" en alguno de los checks arriba:

PROBLEMA 1: No existe destination_countries
→ SOLUCIÓN: Ejecutar CREATE TABLE destination_countries

PROBLEMA 2: No existe shipping_addresses
→ SOLUCIÓN: Ejecutar CREATE TABLE shipping_addresses

PROBLEMA 3: route_logistics_costs no tiene destination_country_id
→ SOLUCIÓN: ALTER TABLE route_logistics_costs ADD COLUMN destination_country_id UUID

PROBLEMA 4: shipping_addresses no tiene destination_country_id
→ SOLUCIÓN: ALTER TABLE shipping_addresses ADD COLUMN destination_country_id UUID

PROBLEMA 5: No hay usuarios con dirección
→ SOLUCIÓN: Crear direcciones de envío para los usuarios:
   INSERT INTO shipping_addresses (user_id, destination_country_id, ...)
   VALUES ('user-uuid', 'country-uuid', ...)

PROBLEMA 6: No hay rutas
→ SOLUCIÓN: Crear rutas:
   INSERT INTO route_logistics_costs (destination_country_id, segment, cost_per_kg, ...)
   VALUES ('country-uuid', 'china_to_transit', 3.50, ...)

PROBLEMA 7: No hay tiers
→ SOLUCIÓN: Crear tiers:
   INSERT INTO shipping_tiers (route_id, tier_name, tramo_a_cost_per_kg, ...)
   VALUES ('route-uuid', 'EXPRESS', 7.50, ...)

*/
