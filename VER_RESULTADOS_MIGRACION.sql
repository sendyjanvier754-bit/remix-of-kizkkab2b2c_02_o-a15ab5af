-- Ver resultados de la migración

-- 1. Productos consolidados
SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- 2. Variantes creadas
SELECT 
  '🎨 Variantes en seller_catalog_variants' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

-- 3. Stock total
SELECT 
  '📦 Stock total en variantes' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- 4. Detalle completo de productos con variantes
SELECT 
  '🔍 PRODUCTOS CON VARIANTES' as info,
  sc.nombre as producto,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku ORDER BY scv.sku) as skus_variantes,
  array_agg(scv.stock ORDER BY scv.sku) as stocks_por_variante
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre
ORDER BY SUM(scv.stock) DESC NULLS LAST;
