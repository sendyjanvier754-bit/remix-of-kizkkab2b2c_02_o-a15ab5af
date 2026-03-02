-- Diagnosticar por qué algunos productos no tienen variantes

-- 1. Ver seller_catalog con sus datos originales (variant_id y SKU)
SELECT 
  '📋 DATOS ORIGINALES EN SELLER_CATALOG' as info,
  sc.id,
  sc.nombre,
  sc.seller_store_id,
  sc.source_product_id,
  sc.variant_id as variant_id_original,
  sc.sku as sku_original,
  sc.stock as stock_original
FROM seller_catalog sc
WHERE sc.source_product_id IS NOT NULL
ORDER BY sc.nombre, sc.sku;

-- 2. Verificar si esos variant_ids existen en product_variants
SELECT 
  '🔍 VERIFICAR VARIANT_IDS EN PRODUCT_VARIANTS' as info,
  sc.nombre,
  sc.variant_id,
  sc.sku,
  CASE 
    WHEN pv.id IS NOT NULL THEN '✅ Existe'
    ELSE '❌ No existe'
  END as existe_variant
FROM seller_catalog sc
LEFT JOIN product_variants pv ON pv.id = sc.variant_id
WHERE sc.source_product_id IS NOT NULL
  AND sc.variant_id IS NOT NULL
ORDER BY sc.nombre;

-- 3. Buscar variantes por SKU si no tienen variant_id
SELECT 
  '🔎 BUSCAR VARIANTES POR SKU' as info,
  sc.nombre,
  sc.sku,
  sc.source_product_id,
  pv.id as variant_encontrado,
  pv.sku as variant_sku
FROM seller_catalog sc
LEFT JOIN product_variants pv ON pv.product_id = sc.source_product_id 
  AND pv.sku = sc.sku
WHERE sc.source_product_id IS NOT NULL
  AND (sc.variant_id IS NULL OR sc.variant_id NOT IN (SELECT id FROM product_variants))
ORDER BY sc.nombre;
