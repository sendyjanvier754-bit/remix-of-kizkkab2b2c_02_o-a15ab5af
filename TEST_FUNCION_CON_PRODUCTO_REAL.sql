-- Obtener producto e variant_id real del carrito actual
SELECT 
  'Productos en carrito' as info,
  bci.product_id,
  bci.variant_id,
  p.nombre,
  pv.name as variante
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
LIMIT 1;

-- Probar get_product_weight con el producto real
-- (copia el product_id y variant_id del resultado anterior)
SELECT 
  'TEST con producto real' as info,
  get_product_weight(
    '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'::uuid,
    '29012345-5912-3456-7890-123456789012'::uuid
  ) as peso_calculado_test,
  -- También probar sin variant_id
  get_product_weight(
    '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'::uuid,
    NULL
  ) as peso_sin_variante;
