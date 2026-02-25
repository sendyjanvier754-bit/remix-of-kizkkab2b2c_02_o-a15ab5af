-- ============================================================================
-- VERIFICAR COLUMNAS EN order_items_b2b
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;

-- ============================================================================
-- El código está intentando insertar:
-- - order_id
-- - product_id
-- - sku
-- - nombre
-- - cantidad
-- - precio_unitario
-- - subtotal  <--- ESTE ES EL QUE FALLA
-- ============================================================================
