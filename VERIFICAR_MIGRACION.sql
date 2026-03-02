-- =====================================================
-- VERIFICAR RESULTADOS DE LA MIGRACIÓN
-- =====================================================

-- 1. Productos en seller_catalog
SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- 2. Variantes en seller_catalog_variants
SELECT 
  '🎨 Variantes en seller_catalog_variants' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

-- 3. Stock total en variantes
SELECT 
  '📦 Stock total en variantes' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- 4. Ver productos con sus variantes
SELECT 
  '🔍 PRODUCTOS CON VARIANTES' as info,
  sc.id as catalog_id,
  sc.nombre as producto,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku) as skus
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre
ORDER BY COUNT(scv.id) DESC
LIMIT 10;

-- 5. Ver la nueva vista v_seller_catalog_with_variants
SELECT 
  '👁️ VISTA: v_seller_catalog_with_variants' as info,
  catalog_id,
  nombre,
  total_variantes,
  total_stock,
  tiene_variantes_disponibles
FROM v_seller_catalog_with_variants
ORDER BY total_variantes DESC
LIMIT 5;
