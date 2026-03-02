-- Ver qué atributos de variante se guardaron en order_items_b2b

SELECT 
  '🔍 ATRIBUTOS DE VARIANTES EN PEDIDOS' as info,
  oi.id as item_id,
  o.id as order_id,
  o.status,
  p.nombre as producto_nombre,
  oi.product_id,
  oi.variant_id,
  oi.sku,
  oi.color,
  oi.size,
  oi.variant_attributes,
  oi.cantidad,
  -- Intentar encontrar el variant_id correcto
  pv.id as variant_encontrado,
  pv.sku as variant_sku_encontrado
FROM order_items_b2b oi
JOIN orders_b2b o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN product_variants pv ON (
  pv.product_id = oi.product_id 
  AND (
    -- Buscar por color y size si existen
    (oi.color IS NOT NULL AND oi.size IS NOT NULL 
     AND pv.attribute_combination->>'color' = oi.color 
     AND pv.attribute_combination->>'size' = oi.size)
    OR
    -- O buscar solo por color
    (oi.color IS NOT NULL AND oi.size IS NULL 
     AND pv.attribute_combination->>'color' = oi.color)
    OR
    -- O buscar solo por size
    (oi.color IS NULL AND oi.size IS NOT NULL 
     AND pv.attribute_combination->>'size' = oi.size)
  )
)
ORDER BY o.created_at DESC
LIMIT 10;
