-- Ver los valores específicos de peso del producto en el carrito
SELECT 
  p.id,
  p.nombre,
  p.peso_kg,
  p.peso_g,
  p.peso_kg as peso_en_kg,
  (p.peso_g::numeric / 1000.0) as peso_g_convertido_a_kg
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
GROUP BY p.id, p.nombre, p.peso_kg, p.peso_g;

-- Ver las variantes y sus pesos
SELECT 
  pv.id as variant_id,
  p.nombre as producto,
  pv.name as variante,
  pv.peso_kg as variante_peso_kg,
  pv.peso_g as variante_peso_g,
  p.peso_kg as producto_peso_kg,
  p.peso_g as producto_peso_g,
  -- Peso final usando COALESCE (NULLIF trata 0 como NULL)
  COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_final_kg
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0';
