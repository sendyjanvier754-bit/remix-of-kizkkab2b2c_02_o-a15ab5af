-- =============================================================================
-- VERIFICAR funciones calculate_suggested_pvp
-- =============================================================================

-- 1. Ver todas las funciones con ese nombre
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosrc as source_code_snippet
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%calculate_suggested_pvp%'
  AND n.nspname = 'public'
ORDER BY p.proname;

-- 2. Ver definiciones completas
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%calculate_suggested_pvp%'
  AND n.nspname = 'public';
