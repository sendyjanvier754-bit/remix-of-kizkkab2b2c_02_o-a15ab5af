-- =====================================================
-- MIGRAR PRODUCTOS DE seller_catalog SIN VARIANTES
-- Crear registros en seller_catalog_variants para productos
-- que fueron importados antes de la actualización
-- =====================================================

-- Verificar productos sin variantes
SELECT 
  sc.id as catalog_id,
  sc.nombre,
  sc.sku,
  sc.source_product_id,
  sc.source_order_id,
  COUNT(scv.id) as variantes_count
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
GROUP BY sc.id, sc.nombre, sc.sku, sc.source_product_id, sc.source_order_id
HAVING COUNT(scv.id) = 0;

-- Crear variantes para productos sin variantes
-- Solo para productos que SÍ tienen variantes en product_variants
INSERT INTO seller_catalog_variants (
  seller_catalog_id,
  variant_id,
  sku,
  precio_override,
  stock,
  is_available,
  availability_status
)
SELECT DISTINCT ON (sc.id, pv.id)
  sc.id as seller_catalog_id,
  pv.id as variant_id,
  pv.sku,
  COALESCE(sc.precio_venta, pv.price) as precio_override,
  COALESCE(sc.stock, 0) as stock,
  COALESCE(sc.is_active, true) as is_available,
  'available' as availability_status
FROM seller_catalog sc
INNER JOIN product_variants pv ON pv.product_id = sc.source_product_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id AND scv.variant_id = pv.id
WHERE scv.id IS NULL  -- Solo si no existe ya esta combinación
  AND sc.source_product_id IS NOT NULL  -- Solo productos con fuente
  AND pv.id IS NOT NULL  -- Solo variantes válidas
ON CONFLICT (seller_catalog_id, variant_id) DO NOTHING;

SELECT '✅ Migración completada' as resultado;

-- Verificar resultados
SELECT 
  'Productos con variantes' as tipo,
  COUNT(DISTINCT sc.id) as cantidad
FROM seller_catalog sc
INNER JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id

UNION ALL

SELECT 
  'Productos sin variantes' as tipo,
  COUNT(sc.id) as cantidad
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE scv.id IS NULL;

-- Verificar que ahora aparecen en la vista
SELECT 
  'En vista (Importados)' as tipo,
  COUNT(*) as cantidad
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NULL

UNION ALL

SELECT 
  'En vista (Inventario)' as tipo,
  COUNT(*) as cantidad
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NOT NULL;
