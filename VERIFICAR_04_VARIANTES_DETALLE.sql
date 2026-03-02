-- Ver todas las variantes creadas
SELECT 
  scv.id,
  scv.seller_catalog_id,
  sc.nombre as producto,
  scv.variant_id,
  scv.sku,
  scv.stock,
  scv.is_available
FROM seller_catalog_variants scv
JOIN seller_catalog sc ON sc.id = scv.seller_catalog_id
ORDER BY sc.nombre, scv.sku;
