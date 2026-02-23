-- ============================================================
-- AUDITORÍA: Tablas del Módulo Logística Local
-- ⚠️  Ejecutar CADA BLOQUE por separado (seleccionar + Run)
-- ============================================================

-- ══════════════════════════════════════════════
-- BLOQUE 1 — Columnas de todas las tablas locales
--            + estado respecto a TICKET #22
-- ══════════════════════════════════════════════
SELECT
  table_name,
  ordinal_position AS pos,
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE
    WHEN table_name = 'transit_hubs'
     AND column_name IN ('hub_type','destination_country_id','address','lat','lng')
     THEN '⚠️ FALTA — agregar TICKET #22'
    WHEN table_name = 'communes'
     AND column_name = 'transit_hub_id'
     THEN '⚠️ FALTA — agregar TICKET #22'
    ELSE '✅ ya existe'
  END AS estado_ticket22
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transit_hubs','communes','departments','pickup_points','shipping_zones')
ORDER BY table_name, ordinal_position;

-- ══════════════════════════════════════════════
-- BLOQUE 2 — Conteo de registros
-- ══════════════════════════════════════════════
SELECT 'transit_hubs' AS tabla, COUNT(*) AS registros FROM public.transit_hubs
UNION ALL
SELECT 'departments',           COUNT(*)               FROM public.departments
UNION ALL
SELECT 'communes',              COUNT(*)               FROM public.communes
UNION ALL
SELECT 'pickup_points',         COUNT(*)               FROM public.pickup_points
UNION ALL
SELECT 'shipping_zones',        COUNT(*)               FROM public.shipping_zones
UNION ALL
SELECT 'local_expedition_ids',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='local_expedition_ids'
  ) THEN 1 ELSE 0 END;

-- ══════════════════════════════════════════════
-- BLOQUE 3 — Datos reales de transit_hubs
-- ══════════════════════════════════════════════
SELECT id, name, code, description, is_active
FROM public.transit_hubs
ORDER BY name;

-- ══════════════════════════════════════════════
-- BLOQUE 4 — Datos reales de departments
-- ══════════════════════════════════════════════
SELECT id, name, code, is_active
FROM public.departments
ORDER BY name;

-- ══════════════════════════════════════════════
-- BLOQUE 5 — Datos reales de communes con precios
-- ══════════════════════════════════════════════
SELECT
  c.id,
  c.name              AS commune,
  c.code,
  d.name              AS department,
  c.rate_per_lb,
  c.delivery_fee,
  c.operational_fee,
  c.extra_department_fee,
  c.is_active
FROM public.communes c
LEFT JOIN public.departments d ON d.id = c.department_id
ORDER BY d.name, c.name;

-- ══════════════════════════════════════════════
-- BLOQUE 6 — Foreign Keys de estas tablas
-- ══════════════════════════════════════════════
SELECT
  tc.table_name       AS tabla_origen,
  kcu.column_name     AS columna_fk,
  ccu.table_name      AS tabla_destino,
  ccu.column_name     AS columna_destino
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema   = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
  AND tc.table_name IN ('transit_hubs','communes','departments','pickup_points','shipping_zones')
ORDER BY tc.table_name, kcu.column_name;

SELECT
  '1. transit_hubs' AS tabla,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transit_hubs'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 2. COLUMNAS DE communes
-- ─────────────────────────────────────────────────────────────
SELECT
  '2. communes' AS tabla,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'communes'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 3. COLUMNAS DE departments
-- ─────────────────────────────────────────────────────────────
SELECT
  '3. departments' AS tabla,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'departments'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 4. COLUMNAS DE pickup_points
-- ─────────────────────────────────────────────────────────────
SELECT
  '4. pickup_points' AS tabla,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pickup_points'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 5. COLUMNAS DE shipping_zones
-- ─────────────────────────────────────────────────────────────
SELECT
  '5. shipping_zones' AS tabla,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_zones'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 6. FOREIGN KEYS entre estas tablas
-- ─────────────────────────────────────────────────────────────
SELECT
  tc.table_name        AS tabla_origen,
  kcu.column_name      AS columna_fk,
  ccu.table_name       AS tabla_destino,
  ccu.column_name      AS columna_destino,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('transit_hubs', 'communes', 'departments', 'pickup_points', 'shipping_zones')
ORDER BY tc.table_name, kcu.column_name;

-- ─────────────────────────────────────────────────────────────
-- 7. CONTEO DE REGISTROS en cada tabla
-- ─────────────────────────────────────────────────────────────
SELECT 'transit_hubs'  AS tabla, COUNT(*) AS registros FROM public.transit_hubs
UNION ALL
SELECT 'departments',             COUNT(*) FROM public.departments
UNION ALL
SELECT 'communes',                COUNT(*) FROM public.communes
UNION ALL
SELECT 'pickup_points',           COUNT(*) FROM public.pickup_points
UNION ALL
SELECT 'shipping_zones',          COUNT(*) FROM public.shipping_zones;

-- ─────────────────────────────────────────────────────────────
-- 8. DATOS REALES de transit_hubs (ver nombres y codes existentes)
-- ─────────────────────────────────────────────────────────────
SELECT id, name, code, description, is_active
FROM public.transit_hubs
ORDER BY name;

-- ─────────────────────────────────────────────────────────────
-- 9. DATOS REALES de departments
-- ─────────────────────────────────────────────────────────────
SELECT id, name, code, is_active
FROM public.departments
ORDER BY name;

-- ─────────────────────────────────────────────────────────────
-- 10. DATOS REALES de communes (con sus precios locales)
-- ─────────────────────────────────────────────────────────────
SELECT
  c.id,
  c.name,
  c.code,
  c.department_id,
  d.name AS department_name,
  c.rate_per_lb,
  c.delivery_fee,
  c.operational_fee,
  c.extra_department_fee,
  c.is_active
FROM public.communes c
LEFT JOIN public.departments d ON d.id = c.department_id
ORDER BY d.name, c.name;

-- ─────────────────────────────────────────────────────────────
-- 11. VERIFICAR si las columnas de TICKET #22 ya existen
--     (hub_type, transit_hub_id en communes, etc.)
-- ─────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  CASE WHEN column_name IN ('hub_type', 'transit_hub_id', 'lat', 'lng', 'address', 'destination_country_id')
       THEN '⚠️ COLUMNA DE TICKET #22'
       ELSE '✅ ya existe'
  END AS estado
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transit_hubs', 'communes')
ORDER BY table_name, ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 12. VERIFICAR si local_expedition_ids ya existe
-- ─────────────────────────────────────────────────────────────
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'local_expedition_ids'
  ) THEN '✅ local_expedition_ids YA EXISTE'
  ELSE '🔴 local_expedition_ids NO EXISTE — crear con TICKET #22'
  END AS estado_table;
