CREATE OR REPLACE VIEW public.v_seller_catalog_with_variants AS
SELECT sc.id AS catalog_id,
    sc.seller_store_id,
    sc.source_product_id,
    sc.source_order_id,
    sc.nombre,
    sc.descripcion,
    sc.images,
    sc.is_active,
    sc.imported_at AS catalog_created_at,
    sc.precio_costo,
    sc.precio_b2b_base,
    sc.costo_logistica,
    p.nombre AS product_name,
    p.descripcion_corta AS product_description,
    p.imagen_principal AS product_image,
    p.galeria_imagenes AS product_images,
    count(scv.id) AS total_variantes,
    sum(scv.stock) AS total_stock,
    json_agg(json_build_object(
      'variant_id', scv.id,
      'product_variant_id', scv.variant_id,
      'sku', scv.sku,
      'stock', scv.stock,
      'precio', COALESCE(scv.precio_override, pv.price),
      'is_available', scv.is_available,
      'availability_status', scv.availability_status,
      'attributes', pv.attribute_combination,
      'images', pv.images,
      'is_manual_price', scv.is_manual_price
    ) ORDER BY scv.created_at) FILTER (WHERE (scv.id IS NOT NULL)) AS variantes,
    min(COALESCE(scv.precio_override, pv.price)) AS precio_min,
    max(COALESCE(scv.precio_override, pv.price)) AS precio_max,
    bool_or(scv.is_available) AS tiene_variantes_disponibles
   FROM seller_catalog sc
     LEFT JOIN products p ON p.id = sc.source_product_id
     LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
     LEFT JOIN product_variants pv ON pv.id = scv.variant_id
  WHERE sc.source_product_id IS NOT NULL
  GROUP BY sc.id, sc.seller_store_id, sc.source_product_id, sc.source_order_id, sc.nombre, sc.descripcion, sc.images, sc.is_active, sc.imported_at, sc.precio_costo, sc.precio_b2b_base, sc.costo_logistica, p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes;