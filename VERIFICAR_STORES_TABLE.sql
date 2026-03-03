-- =====================================================
-- VERIFICAR ESTRUCTURA DE TABLA stores
-- =====================================================

-- Ver todas las columnas de la tabla stores
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stores'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver si stores tiene 'nombre' o 'name'
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'stores'
  AND table_schema = 'public'
  AND column_name IN ('nombre', 'name');
