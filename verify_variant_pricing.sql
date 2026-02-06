-- Verificar que las vistas de variantes fueron creadas correctamente
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que la vista existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('v_variantes_con_precio_b2b', 'v_variantes_precio_simple');

-- 2. Ver ejemplo de precios calculados (usa un product_id real de tu BD)
SELECT 
  sku,
  name,
  costo_base_variante,
  applied_margin_percent,
  precio_b2b_final,
  parent_sku,
  product_name
FROM v_variantes_con_precio_b2b
LIMIT 5;

-- 3. Comparar variantes del mismo producto para ver precios diferentes
SELECT 
  product_id,
  COUNT(*) as total_variantes,
  MIN(precio_b2b_final) as precio_min,
  MAX(precio_b2b_final) as precio_max,
  AVG(precio_b2b_final) as precio_promedio
FROM v_variantes_con_precio_b2b
GROUP BY product_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;
