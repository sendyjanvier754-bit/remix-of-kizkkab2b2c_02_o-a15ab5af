-- =============================================================================
-- VERIFICAR si existe la vista v_logistics_data
-- =============================================================================

-- 1. Ver si la vista existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'v_logistics_data';

-- 2. Ver definición de la vista (si existe)
SELECT 
  pg_get_viewdef('public.v_logistics_data'::regclass, true) as view_definition;

-- 3. Ver registros de ejemplo (si existe)
SELECT *
FROM v_logistics_data
LIMIT 5;

-- 4. Ver todas las vistas relacionadas con logística
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'VIEW'
  AND table_name LIKE '%logist%'
ORDER BY table_name;

-- 5. Ver columnas de v_logistics_data (si existe)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_logistics_data'
ORDER BY ordinal_position;
