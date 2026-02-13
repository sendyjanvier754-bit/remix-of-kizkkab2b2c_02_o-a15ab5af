-- Actualizar peso_kg de TODOS los items del carrito abiertos
UPDATE b2b_cart_items bci
SET peso_kg = (
  CASE 
    WHEN bci.variant_id IS NOT NULL THEN
      -- Item tiene variante: usar lógica COALESCE completa
      -- NULLIF trata 0 como NULL para que revise peso_g
      (SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = bci.variant_id)
    ELSE
      -- Item sin variante: usar peso del producto
      (SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0)
       FROM products p
       WHERE p.id = bci.product_id)
  END
)
FROM b2b_carts bc
WHERE bci.cart_id = bc.id
  AND bc.status = 'open'
  AND (bci.peso_kg IS NULL OR bci.peso_kg = 0);

-- Verificar actualización
SELECT 
  '✅ ITEMS ACTUALIZADOS' as info,
  bci.id,
  p.nombre,
  pv.name as variante,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
ORDER BY bci.created_at DESC;

-- Ver costo total
SELECT 
  '💰 COSTO DE ENVÍO ACTUALIZADO' as info,
  bc.id as cart_id,
  COUNT(bci.id) as total_items,
  SUM(bci.quantity) as total_quantity,
  SUM(bci.peso_kg * bci.quantity) as total_weight_kg,
  CEIL(SUM(bci.peso_kg * bci.quantity))::INTEGER as weight_rounded_kg,
  CASE 
    WHEN CEIL(SUM(bci.peso_kg * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(bci.peso_kg * bci.quantity)) - 1) * 5.82)
  END as costo_envio
FROM b2b_carts bc
JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id;
