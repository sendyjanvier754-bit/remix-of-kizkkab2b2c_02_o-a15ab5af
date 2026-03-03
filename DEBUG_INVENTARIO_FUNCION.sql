-- =====================================================
-- VERIFICAR FUNCIÓN ACTUAL get_inventario_b2c
-- =====================================================

-- Ver la definición completa de la función actual
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventario_b2c';

-- Ver todas las funciones que contienen "inventario"
SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%inventario%';
