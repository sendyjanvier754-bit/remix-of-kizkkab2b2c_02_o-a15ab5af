-- Limpiar productos sin variantes (huérfanos)

-- Ver qué se eliminará
SELECT 
  '🗑️ Productos a eliminar (sin variantes)' as info,
  sc.id,
  sc.nombre,
  s.name as tienda
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
WHERE sc.source_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  );

-- Eliminar productos huérfanos
DELETE FROM seller_catalog
WHERE source_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  );

SELECT '✅ Productos huérfanos eliminados' as resultado;

-- Ver resultado FINAL limpio
SELECT 
  '✅ CATÁLOGO FINAL (solo productos con variantes)' as info,
  sc.nombre as producto,
  s.name as tienda,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku ORDER BY scv.sku) as variantes,
  array_agg(scv.stock ORDER BY scv.sku) as stocks
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre, s.name
ORDER BY s.name, sc.nombre;

SELECT '🎉 MIGRACIÓN COMPLETADA - Arquitectura Amazon/Alibaba implementada' as resultado;
