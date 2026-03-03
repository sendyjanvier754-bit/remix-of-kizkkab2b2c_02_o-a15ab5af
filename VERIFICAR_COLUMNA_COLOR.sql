-- =====================================================
-- VERIFICAR si product_variants tiene columna color
-- =====================================================

-- Ver todas las columnas de product_variants
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'product_variants'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver si existe la función actual
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventario_b2c';
