-- =====================================================================
-- Exponer precio_costo, precio_b2b_base y costo_logistica reales
-- desde seller_catalog en la vista v_seller_catalog_with_variants
-- Estos valores son escritos por el trigger al pagar una orden B2B,
-- reflejando el precio exacto que pagó el seller, no un recálculo.
-- =====================================================================

DROP VIEW IF EXISTS v_seller_catalog_with_variants CASCADE;

CREATE OR REPLACE VIEW v_seller_catalog_with_variants AS
SELECT 
  -- Datos del producto principal
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.source_order_id,
  sc.nombre,
  sc.descripcion,
  sc.images,
  sc.is_active,
  sc.imported_at as catalog_created_at,

  -- ✅ Precio real pagado por el seller (escrito por trigger al pagar la orden B2B)
  sc.precio_costo,        -- precio_b2b_base + costo_logistica (costo total real)
  sc.precio_b2b_base,     -- precio unitario B2B de la orden (sin logi­stica)
  sc.costo_logistica,     -- costo de envio por unidad en el momento de la compra

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
  
  -- Rango de precios de venta al publico
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
  sc.precio_costo, sc.precio_b2b_base, sc.costo_logistica,
  p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes;

-- Permisos
GRANT SELECT ON v_seller_catalog_with_variants TO authenticated;
GRANT SELECT ON v_seller_catalog_with_variants TO anon;

SELECT '✅ Vista actualizada con precio_costo, precio_b2b_base y costo_logistica reales' AS resultado;
