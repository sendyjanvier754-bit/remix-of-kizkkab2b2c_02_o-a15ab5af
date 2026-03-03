-- =====================================================
-- DEBUG: Verificar por qué solo aparece 1 producto en Marketing
-- cuando hay 2 en Mi Catálogo
-- =====================================================

-- 1️⃣ Ver todos los productos en seller_catalog (importados)
SELECT 
  'seller_catalog (importados)' as tabla,
  id as catalog_id,
  nombre,
  sku,
  source_product_id,
  source_order_id,
  CASE WHEN source_order_id IS NULL THEN '📦 Importado' ELSE '🛒 Inventario' END as tipo
FROM seller_catalog
WHERE source_order_id IS NULL
ORDER BY nombre;

-- 2️⃣ Ver las variantes asociadas a cada producto
SELECT 
  'seller_catalog_variants' as tabla,
  scv.id as variant_id,
  scv.seller_catalog_id as catalog_id,
  sc.nombre as producto,
  sc.source_product_id,
  sc.source_order_id,
  scv.sku as variant_sku,
  CASE WHEN sc.source_order_id IS NULL THEN '📦 Importado' ELSE '🛒 Inventario' END as tipo
FROM seller_catalog_variants scv
JOIN seller_catalog sc ON sc.id = scv.seller_catalog_id
WHERE sc.source_order_id IS NULL
ORDER BY sc.nombre, scv.sku;

-- 3️⃣ Ver cómo se ven en la vista (lo que Marketing recibe)
SELECT 
  'v_seller_catalog_with_variants' as vista,
  catalog_id,
  nombre_producto,
  source_product_id,
  source_order_id,
  COUNT(*) as num_variantes,
  CASE WHEN source_order_id IS NULL THEN '📦 Importado' ELSE '🛒 Inventario' END as tipo
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NULL
GROUP BY catalog_id, nombre_producto, source_product_id, source_order_id
ORDER BY nombre_producto;

-- 4️⃣ CLAVE: Ver si hay productos con el MISMO source_product_id  
-- (esto causaría que Marketing los agrupe como UNO)
SELECT 
  '🔍 Agrupación por source_product_id' as analisis,
  source_product_id,
  COUNT(DISTINCT catalog_id) as num_productos_distintos,
  STRING_AGG(DISTINCT nombre_producto, ', ') as nombres
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NULL
GROUP BY source_product_id
HAVING COUNT(DISTINCT catalog_id) > 1;  -- Productos que comparten source_product_id

-- 5️⃣ Ver información completa actual
SELECT 
  catalog_id,
  nombre_producto,
  source_product_id,
  source_order_id,
  total_stock,
  JSONB_ARRAY_LENGTH(variantes) as num_variantes_en_json
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NULL
ORDER BY nombre_producto;
