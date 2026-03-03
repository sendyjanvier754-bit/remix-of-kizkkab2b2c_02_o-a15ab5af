-- =====================================================
-- VERIFICAR NOMBRE REAL DE LA COLUMNA EN order_items_b2b
-- =====================================================

-- Ver las columnas de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'order_items_b2b'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Esto mostrará si la columna se llama:
-- - precio_total (como dice types.ts)
-- - subtotal (como dice la migración)
-- - Otro nombre
