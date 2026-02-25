-- ============================================================================
-- PASO 1: VERIFICAR SI ADDRESSES YA TIENE LAS COLUMNAS
-- ============================================================================
-- Ejecuta esto primero para ver si las columnas ya existen

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'addresses'
  AND column_name IN ('department_id', 'commune_id')
ORDER BY ordinal_position;

-- Si el resultado está VACÍO, continúa con PASO_2
-- Si ves 2 filas (department_id y commune_id), salta al PASO_3
