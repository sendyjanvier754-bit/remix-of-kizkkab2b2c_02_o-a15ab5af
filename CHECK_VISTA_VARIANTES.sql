-- Verificar qué campos tiene la vista v_variantes_con_precio_b2b
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_variantes_con_precio_b2b'
ORDER BY ordinal_position;

-- Ver si la vista existe
SELECT 
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_variantes_con_precio_b2b';

-- Consultar datos de ejemplo para verificar que tiene stock
SELECT 
  id,
  product_id,
  sku,
  name,
  stock,  -- ← Campo crítico
  precio_b2b_final,
  costo_base_variante
FROM v_variantes_con_precio_b2b
WHERE product_id IN (
  SELECT id FROM products WHERE sku_interno = '924221472'
)
LIMIT 10;
