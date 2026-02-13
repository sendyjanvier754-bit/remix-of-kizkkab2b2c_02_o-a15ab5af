-- Ver los últimos items agregados al carrito y verificar si tienen peso_kg
SELECT 
  '🔍 ITEMS MÁS RECIENTES' as info,
  bci.id,
  bci.created_at,
  p.nombre,
  pv.name as variante,
  bci.quantity,
  bci.peso_kg,
  CASE 
    WHEN bci.peso_kg IS NULL THEN '❌ NULL (código viejo)'
    WHEN bci.peso_kg = 0 THEN '⚠️ CERO'
    WHEN bci.peso_kg > 0 THEN '✅ TIENE PESO'
  END as status,
  -- Verificar si product/variant tienen peso
  COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0) as peso_disponible
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
ORDER BY bci.created_at DESC
LIMIT 10;

-- Ver si hay logs de errores en PostgreSQL
SELECT 
  '📋 VERIFICAR PERMISOS RPC' as info,
  routine_name,
  routine_type,
  security_type,
  definer
FROM information_schema.routines
WHERE routine_name = 'get_product_weight';
