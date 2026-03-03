-- =====================================================
-- ACTUALIZAR v_seller_catalog_with_variants
-- Agregar source_order_id para distinguir:
-- - Productos importados: source_order_id IS NULL
-- - Productos de inventario B2B: source_order_id IS NOT NULL
-- =====================================================

DROP VIEW IF EXISTS v_seller_catalog_with_variants CASCADE;

CREATE OR REPLACE VIEW v_seller_catalog_with_variants AS
SELECT 
  -- Datos del producto principal
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.source_order_id,  -- ✅ NUEVO: Permite filtrar por origen
  sc.nombre,
  sc.descripcion,
  sc.images,
  sc.is_active,
  sc.imported_at as catalog_created_at,
  
  -- Datos del producto maestro
  p.nombre as product_name,
  p.descripcion_corta as product_description,
  p.imagen_principal as product_image,
  p.galeria_imagenes as product_images,
  
  -- Agregados de variantes
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as total_stock,
  json_agg(
    json_build_object(
      'variant_id', scv.id,
      'product_variant_id', scv.variant_id,
      'sku', scv.sku,
      'stock', scv.stock,
      'precio', COALESCE(scv.precio_override, pv.price),
      'is_available', scv.is_available,
      'availability_status', scv.availability_status,
      'attributes', pv.attribute_combination,
      'images', pv.images
    ) ORDER BY scv.created_at
  ) FILTER (WHERE scv.id IS NOT NULL) as variantes,
  
  -- Rango de precios
  MIN(COALESCE(scv.precio_override, pv.price)) as precio_min,
  MAX(COALESCE(scv.precio_override, pv.price)) as precio_max,
  
  -- Estado de disponibilidad
  BOOL_OR(scv.is_available) as tiene_variantes_disponibles
  
FROM seller_catalog sc
LEFT JOIN products p ON p.id = sc.source_product_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
LEFT JOIN product_variants pv ON pv.id = scv.variant_id
WHERE sc.source_product_id IS NOT NULL
GROUP BY 
  sc.id, sc.seller_store_id, sc.source_product_id, sc.source_order_id,
  sc.nombre, sc.descripcion, sc.images, sc.is_active, sc.imported_at,
  p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes;

-- Recrear permisos
GRANT SELECT ON v_seller_catalog_with_variants TO authenticated;
GRANT SELECT ON v_seller_catalog_with_variants TO anon;

SELECT '✅ Vista v_seller_catalog_with_variants actualizada con source_order_id' as resultado;

-- Verificar los dos tipos de productos
SELECT 
  'Productos Importados' as tipo,
  COUNT(*) as cantidad
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NULL

UNION ALL

SELECT 
  'Productos de Inventario B2B' as tipo,
  COUNT(*) as cantidad
FROM v_seller_catalog_with_variants
WHERE source_order_id IS NOT NULL;
