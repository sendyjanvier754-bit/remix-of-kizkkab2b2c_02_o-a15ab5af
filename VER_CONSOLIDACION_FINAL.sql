-- Ver resultados finales de la consolidación

-- 1. Total de productos
SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- 2. Total de variantes
SELECT 
  '🎨 Variantes totales' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

-- 3. Stock total
SELECT 
  '📦 Stock total' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- 4. Vista completa: Productos con todas sus variantes
SELECT 
  '🔍 PRODUCTOS CON TODAS SUS VARIANTES' as info,
  sc.nombre as producto,
  s.name as tienda,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku ORDER BY scv.sku) as variantes_disponibles,
  array_agg(scv.stock ORDER BY scv.sku) as stock_por_variante
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre, s.name
ORDER BY s.name, sc.nombre;
