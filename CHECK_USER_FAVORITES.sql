-- =====================================================
-- VERIFICAR ÚLTIMO FAVORITO AGREGADO
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Los 5 más recientes con fecha/hora y nombre del producto
SELECT
  uf.id,
  uf.type                                          AS tipo_b2b_b2c,
  uf.created_at AT TIME ZONE 'America/Port-au-Prince'
                                                   AS fecha_hora_local,
  CASE
    WHEN uf.product_id       IS NOT NULL THEN 'product_id'
    WHEN uf.seller_catalog_id IS NOT NULL THEN 'seller_catalog_id'
    ELSE 'SIN ID'
  END                                              AS guardado_en,
  p.nombre                                         AS nombre_producto_b2b,
  sc.nombre                                        AS nombre_producto_b2c,
  uf.product_id,
  uf.seller_catalog_id,
  uf.variant_id,
  uf.user_id
FROM user_favorites uf
LEFT JOIN products      p  ON p.id  = uf.product_id
LEFT JOIN seller_catalog sc ON sc.id = uf.seller_catalog_id
ORDER BY uf.created_at DESC
LIMIT 5;

-- =====================================================
-- 2. Resumen total por tipo (B2B vs B2C)
-- =====================================================
SELECT
  type                                             AS tipo,
  COUNT(*)                                         AS total,
  COUNT(product_id)                                AS con_product_id,
  COUNT(seller_catalog_id)                         AS con_seller_catalog_id,
  COUNT(variant_id)                                AS con_variant_id
FROM user_favorites
GROUP BY type
ORDER BY type;
