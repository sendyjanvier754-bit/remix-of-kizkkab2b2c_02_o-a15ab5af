-- Ver qué items tienen peso_kg NULL
SELECT 
  'Items SIN peso_kg' as info,
  bci.id,
  bci.created_at,
  p.nombre,
  pv.name as variante,
  bci.quantity,
  bci.peso_kg,
  CASE 
    WHEN bci.peso_kg IS NULL THEN '❌ NULL'
    WHEN bci.peso_kg = 0 THEN '⚠️ CERO'
    ELSE '✅ OK'
  END as status
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
ORDER BY bci.created_at DESC;
