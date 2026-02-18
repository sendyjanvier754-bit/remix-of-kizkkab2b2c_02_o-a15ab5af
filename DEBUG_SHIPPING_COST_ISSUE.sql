-- ============================================================================
-- DEBUG: Verificar por qué no se muestra costo de envío
-- ============================================================================

-- 1. Verificar si hay tiers activos para la ruta China → Haiti
SELECT 
  '📍 PASO 1: Verificar tiers activos' as paso,
  COUNT(*) as total_tiers,
  COUNT(*) FILTER (WHERE is_active = TRUE) as tiers_activos
FROM shipping_tiers
WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- 2. Ver TODOS los tiers de esa ruta
SELECT 
  '📍 PASO 2: Detalles de tiers para China → Haiti' as paso,
  id,
  tier_name,
  custom_tier_name,
  tier_type,
  transport_type,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  is_active,
  priority_order
FROM shipping_tiers
WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
ORDER BY priority_order;

-- 3. Probar calcular con un tier específico
DO $$
DECLARE
  v_tier_id UUID;
  v_result RECORD;
  v_test_weight NUMERIC := 0.714; -- Peso del item en la imagen (714g)
BEGIN
  -- Obtener primer tier activo de la ruta
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
    AND is_active = TRUE
  ORDER BY priority_order
  LIMIT 1;
  
  IF v_tier_id IS NULL THEN
    RAISE WARNING '⚠️ NO HAY TIERS ACTIVOS para la ruta China → Haiti';
  ELSE
    RAISE NOTICE '📍 PASO 3: Probando con tier: %', v_tier_id;
    
    -- Calcular costo
    SELECT * INTO v_result
    FROM calculate_shipping_cost_cart(
      v_test_weight,
      v_tier_id,
      FALSE
    );
    
    RAISE NOTICE '✅ Costo calculado:';
    RAISE NOTICE '   - Peso original: % kg', v_test_weight;
    RAISE NOTICE '   - Peso redondeado: % kg', v_result.weight_rounded_kg;
    RAISE NOTICE '   - Costo base: $%', v_result.base_cost;
    RAISE NOTICE '   - Costo total: $%', v_result.total_cost_with_type;
    RAISE NOTICE '   - Tier: %', v_result.shipping_type_display;
  END IF;
END $$;

-- 4. Verificar si el usuario tiene items en el carrito
SELECT 
  '📍 PASO 4: Items en carrito' as paso,
  COUNT(*) as total_items,
  SUM(bci.quantity) as total_cantidad,
  SUM(bci.peso_kg * bci.quantity) as peso_total_kg
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid();

-- 5. Ver primer item del carrito (si existe)
SELECT 
  '📍 PASO 5: Primer item del carrito' as paso,
  bci.id as item_id,
  bci.product_id,
  bci.variant_id,
  bci.quantity as cantidad,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid()
LIMIT 1;

-- 6. Simular llamada al orquestador con items reales
DO $$
DECLARE
  v_item_ids UUID[];
  v_tier_id UUID;
  v_result JSON;
BEGIN
  -- Obtener IDs de items del carrito del usuario
  SELECT array_agg(bci.id)
  INTO v_item_ids
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.buyer_user_id = auth.uid();
  
  -- Obtener primer tier activo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
    AND is_active = TRUE
  ORDER BY priority_order
  LIMIT 1;
  
  IF array_length(v_item_ids, 1) IS NULL THEN
    RAISE WARNING '⚠️ El usuario NO tiene items en el carrito';
  ELSIF v_tier_id IS NULL THEN
    RAISE WARNING '⚠️ NO hay tier activo disponible';
  ELSE
    RAISE NOTICE '📍 PASO 6: Llamando al ORQUESTADOR';
    RAISE NOTICE '   - Items: %', array_length(v_item_ids, 1);
    RAISE NOTICE '   - Tier: %', v_tier_id;
    
    -- Llamar al orquestador
    SELECT calculate_shipping_cost_for_selected_items(
      v_item_ids,
      v_tier_id
    ) INTO v_result;
    
    RAISE NOTICE '✅ Resultado del orquestador:';
    RAISE NOTICE '%', v_result::text;
  END IF;
END $$;

SELECT '✅ DEBUG COMPLETADO' as status;
