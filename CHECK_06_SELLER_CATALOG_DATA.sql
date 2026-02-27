-- Ver datos de ejemplo de seller_catalog

SELECT 
  '📦 MUESTRA: seller_catalog (primeros 3)' as info,
  id,
  seller_store_id,
  source_product_id,
  sku,
  nombre,
  descripcion,
  images
FROM seller_catalog
WHERE source_product_id IS NOT NULL
LIMIT 3;
