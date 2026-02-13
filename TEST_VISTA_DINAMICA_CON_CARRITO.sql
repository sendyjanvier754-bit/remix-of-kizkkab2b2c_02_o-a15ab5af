-- ===========================================================================
-- TEST: Vista dinámica v_cart_shipping_costs con carrito real
-- Verificar que calcula correctamente con items
-- ===========================================================================

-- =============================================================================
-- PASO 1: Agregar items de prueba a tu carrito
-- =============================================================================

-- Primero, obtener tu cart_id activo (o crear uno)
DO $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cart_id UUID;
BEGIN
  -- Buscar carrito abierto del usuario
  SELECT id INTO v_cart_id
  FROM b2b_carts
  WHERE buyer_user_id = v_user_id
    AND status = 'open';
  
  -- Si no existe, crear uno
  IF v_cart_id IS NULL THEN
    INSERT INTO b2b_carts (buyer_user_id, status)
    VALUES (v_user_id, 'open')
    RETURNING id INTO v_cart_id;
    
    RAISE NOTICE 'Carrito creado: %', v_cart_id;
  ELSE
    RAISE NOTICE 'Usando carrito existente: %', v_cart_id;
  END IF;
  
  -- Limpiar items anteriores (opcional)
  DELETE FROM b2b_cart_items WHERE cart_id = v_cart_id;
  
  -- Agregar 2 productos de prueba (0.300kg cada uno)
  -- Reemplaza estos product_id con IDs reales de tu DB
  INSERT INTO b2b_cart_items (cart_id, product_id, variant_id, quantity)
  VALUES 
    (v_cart_id, (SELECT id FROM products LIMIT 1 OFFSET 0), NULL, 1),
    (v_cart_id, (SELECT id FROM products LIMIT 1 OFFSET 1), NULL, 1);
  
  RAISE NOTICE 'Items agregados al carrito';
END $$;


-- =============================================================================
-- PASO 2: Consultar la vista dinámica (debería mostrar costo > 0)
-- =============================================================================

SELECT 
  '🛒 Tu carrito (Vista Dinámica)' as info,
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 3) as "Peso (kg)",
  weight_rounded_kg as "Peso Redondeado",
  ROUND(base_cost::numeric, 2) as "Costo Base",
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL (USD)",
  shipping_type_display as "Tipo Envío"
FROM v_cart_shipping_costs;


-- =============================================================================
-- PASO 3: Comparar con función directa (deben ser iguales)
-- =============================================================================

SELECT 
  'Vista Dinámica' as source,
  total_items,
  ROUND(total_weight_kg::numeric, 3) as peso_kg,
  ROUND(total_cost_with_type::numeric, 2) as costo_usd
FROM v_cart_shipping_costs

UNION ALL

SELECT 
  'Función get_user_cart_shipping_cost' as source,
  (result->>'total_items')::integer as total_items,
  ROUND((result->>'total_weight_kg')::numeric, 3) as peso_kg,
  ROUND((result->>'total_cost_with_type')::numeric, 2) as costo_usd
FROM (
  SELECT get_user_cart_shipping_cost(auth.uid()) as result
) sub;

-- ✅ Ambos deberían dar el MISMO resultado (mayor a 0)


-- =============================================================================
-- PASO 4: Ver items en tu carrito
-- =============================================================================

SELECT 
  '📦 Items en tu carrito' as info,
  ci.id,
  p.name as producto,
  pv.name as variante,
  COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 as peso_kg,
  ci.quantity,
  (COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 * ci.quantity) as peso_total_kg
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = auth.uid()
  AND c.status = 'open';


-- =============================================================================
-- PASO 5: Limpiar (opcional - después de probar)
-- =============================================================================

/*
-- Para vaciar tu carrito de prueba:
DELETE FROM b2b_cart_items 
WHERE cart_id IN (
  SELECT id FROM b2b_carts 
  WHERE buyer_user_id = auth.uid() 
    AND status = 'open'
);
*/
