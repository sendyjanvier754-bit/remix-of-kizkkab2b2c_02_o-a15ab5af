-- Ver productos con sus variantes
SELECT 
  sc.id as catalog_id,
  sc.nombre as producto,
  sc.seller_store_id,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku) as skus_variantes
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre, sc.seller_store_id
ORDER BY COUNT(scv.id) DESC;
