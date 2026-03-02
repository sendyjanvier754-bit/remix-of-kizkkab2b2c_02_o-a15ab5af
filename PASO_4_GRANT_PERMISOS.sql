-- =====================================================
-- PASO 4: Dar permisos a la función
-- =====================================================

GRANT EXECUTE ON FUNCTION get_inventario_b2c(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventario_b2c(UUID, TEXT, INTEGER) TO anon;

-- Verificar que se creó
SELECT 
  proname as funcion,
  pg_get_function_arguments(p.oid) as parametros,
  proacl as permisos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname = 'get_inventario_b2c';
