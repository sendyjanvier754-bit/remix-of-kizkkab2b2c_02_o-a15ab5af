-- =====================================================
-- PASO 1: Verificar estructura de tabla stores
-- =====================================================

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stores' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
