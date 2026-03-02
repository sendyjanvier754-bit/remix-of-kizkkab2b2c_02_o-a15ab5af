-- Limpiar productos huérfanos (sin variantes) de seller_catalog

-- Ver qué se va a eliminar
SELECT 
  '🗑️ PRODUCTOS A ELIMINAR' as info,
  sc.id,
  sc.nombre,
  s.name as store_name
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
WHERE sc.source_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  );

-- Eliminar productos sin variantes
DELETE FROM seller_catalog
WHERE source_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  );

SELECT '✅ Productos huérfanos eliminados' as resultado;

-- Verificar resultado final
SELECT 
  '✅ RESULTADO FINAL' as info,
  COUNT(*) as total_productos,
  SUM(CASE WHEN EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  ) THEN 1 ELSE 0 END) as productos_con_variantes,
  SUM(CASE WHEN NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv 
    WHERE scv.seller_catalog_id = sc.id
  ) THEN 1 ELSE 0 END) as productos_sin_variantes
FROM seller_catalog sc
WHERE source_product_id IS NOT NULL;
