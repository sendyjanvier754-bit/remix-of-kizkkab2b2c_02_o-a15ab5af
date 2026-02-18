-- ============================================================================
-- VERIFICAR ESTRUCTURA DE shipping_type_configs
-- ============================================================================

-- 1. Ver columnas de la tabla
SELECT 
  '📋 Columnas de shipping_type_configs' as info,
  column_name,
  data_type,
  character_maximum_length,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_type_configs'
ORDER BY ordinal_position;

-- 2. Ver constraints (primary key, foreign keys, unique, etc)
SELECT 
  '🔒 Constraints' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'shipping_type_configs';

-- 3. Ver índices
SELECT 
  '📇 Índices' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'shipping_type_configs';

-- 4. Ver datos existentes (si hay)
SELECT 
  '📊 Datos existentes en shipping_type_configs' as info,
  COUNT(*) as total_registros
FROM public.shipping_type_configs;

SELECT 
  '📦 Primeros registros' as info,
  *
FROM public.shipping_type_configs
LIMIT 5;

-- 5. Verificar si la tabla existe
SELECT 
  '✅ Tabla existe?' as info,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shipping_type_configs'
  ) as existe;
