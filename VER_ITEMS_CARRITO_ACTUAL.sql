-- =============================================================================
-- VER ITEMS ESPECÍFICOS DEL CARRITO
-- =============================================================================
-- Cart ID: 4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7

SELECT 
  '📦 ITEMS DEL CARRITO CON DETALLE' as info,
  bci.id as item_id,
  p.id as product_id,
  p.nombre as producto,
  p.peso_kg as producto_peso_kg,
  p.peso_g as producto_peso_g,
  pv.id as variant_id,
  pv.name as variante,
  pv.sku as variante_sku,
  pv.peso_kg as variante_peso_kg,
  pv.peso_g as variante_peso_g,
  bci.quantity,
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric/1000.0, p.peso_g::numeric/1000.0, 0) as peso_calculado,
  CASE 
    WHEN pv.peso_kg IS NOT NULL THEN '✅ Variante tiene peso_kg'
    WHEN p.peso_kg IS NOT NULL THEN '⚠️ Solo producto tiene peso_kg'
    WHEN pv.peso_g IS NOT NULL THEN '✅ Variante tiene peso_g'
    WHEN p.peso_g IS NOT NULL THEN '⚠️ Solo producto tiene peso_g'
    ELSE '❌ SIN PESO'
  END as status
FROM b2b_cart_items bci
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bci.cart_id = '4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7'
ORDER BY bci.created_at;
