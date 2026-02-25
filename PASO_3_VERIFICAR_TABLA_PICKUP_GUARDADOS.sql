-- ============================================================================
-- PASO 3: VERIFICAR SI LA TABLA DE PUNTOS GUARDADOS EXISTE
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_saved_pickup_points'
ORDER BY ordinal_position;

-- Si el resultado está VACÍO, continúa con PASO_4
-- Si ves varias filas (id, user_id, pickup_point_id, etc.), la tabla ya existe, salta al PASO_5
