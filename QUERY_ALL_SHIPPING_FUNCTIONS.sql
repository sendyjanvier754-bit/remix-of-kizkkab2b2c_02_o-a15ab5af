-- ============================================================================
-- INVENTARIO: Funciones de Cálculo de Costo de Envío
-- ============================================================================

-- Ver todas las funciones relacionadas con shipping/envío
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as parameters,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%shipping%cost%' 
    OR p.proname LIKE '%calculate%ship%'
    OR p.proname LIKE '%cart%cost%'
  )
ORDER BY p.proname;
