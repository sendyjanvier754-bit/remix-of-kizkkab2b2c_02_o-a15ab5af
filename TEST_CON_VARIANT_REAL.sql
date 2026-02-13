-- Obtener variant_id real y probar función
WITH real_items AS (
  SELECT 
    bci.product_id,
    bci.variant_id,
    p.nombre,
    pv.name as variante
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  JOIN products p ON bci.product_id = p.id
  LEFT JOIN product_variants pv ON bci.variant_id = pv.id
  WHERE bc.status = 'open'
  LIMIT 1
)
SELECT 
  'TEST CON DATOS REALES' as info,
  ri.product_id,
  ri.variant_id,
  ri.nombre,
  ri.variante,
  get_product_weight(ri.product_id, ri.variant_id) as peso_calculado_funcion,
  -- Comparar con cálculo directo
  COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_calculado_directo
FROM real_items ri
LEFT JOIN product_variants pv ON ri.variant_id = pv.id
LEFT JOIN products p ON ri.product_id = p.id;
