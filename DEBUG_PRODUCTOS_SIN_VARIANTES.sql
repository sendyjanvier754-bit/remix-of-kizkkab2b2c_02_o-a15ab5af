-- Verificar por qué algunos productos no tienen variantes

-- 1. Ver los SKUs que no encontraron variant_id
SELECT 
  '❌ ITEMS SIN VARIANT_ID' as info,
  oi.sku,
  oi.product_id,
  p.nombre as producto,
  oi.variant_id,
  -- Intentar parsear el SKU
  split_part(oi.sku, '-', 1) as sku_base,
  split_part(oi.sku, '-', 2) as color_del_sku,
  split_part(oi.sku, '-', 3) as size_del_sku
FROM order_items_b2b oi
JOIN products p ON p.id = oi.product_id
WHERE oi.variant_id IS NULL
  AND oi.sku IS NOT NULL
ORDER BY p.nombre;

-- 2. Ver qué variantes existen para esos productos
SELECT 
  '🔍 VARIANTES DISPONIBLES' as info,
  p.nombre as producto,
  pv.id as variant_id,
  pv.sku as variant_sku,
  pv.attribute_combination
FROM products p
JOIN product_variants pv ON pv.product_id = p.id
WHERE p.id IN (
  SELECT DISTINCT oi.product_id 
  FROM order_items_b2b oi 
  WHERE oi.variant_id IS NULL
)
ORDER BY p.nombre, pv.sku;
