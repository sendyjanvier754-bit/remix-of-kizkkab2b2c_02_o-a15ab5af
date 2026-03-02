-- Generar resumen completo en JSON
SELECT jsonb_build_object(
  'orders_b2b_columns', (
    SELECT jsonb_agg(column_name ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_name = 'orders_b2b' AND table_schema = 'public'
  ),
  'order_items_b2b_columns', (
    SELECT jsonb_agg(column_name ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_name = 'order_items_b2b' AND table_schema = 'public'
  ),
  'seller_catalog_variants_columns', (
    SELECT jsonb_agg(column_name ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_name = 'seller_catalog_variants' AND table_schema = 'public'
  ),
  'order_statuses', (
    SELECT jsonb_object_agg(status, total)
    FROM (
      SELECT status, COUNT(*) as total
      FROM orders_b2b
      GROUP BY status
    ) s
  ),
  'pedidos_con_variant_id', (
    SELECT COUNT(DISTINCT o.id)
    FROM orders_b2b o
    INNER JOIN order_items_b2b oi ON oi.order_id = o.id
    WHERE oi.variant_id IS NOT NULL
  ),
  'inventario_actual', (
    SELECT jsonb_build_object(
      'productos', COUNT(DISTINCT sc.id),
      'variantes', COUNT(scv.id),
      'stock_total', COALESCE(SUM(scv.stock), 0)
    )
    FROM seller_catalog sc
    LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
  )
) as resumen_completo;
