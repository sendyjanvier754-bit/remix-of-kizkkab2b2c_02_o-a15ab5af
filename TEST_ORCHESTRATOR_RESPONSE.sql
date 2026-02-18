-- ============================================================================
-- TEST: Verificar qué retorna calculate_shipping_cost_for_selected_items
-- ============================================================================
-- 
-- Este script llama a la función EXACTAMENTE como lo hace el frontend
-- y muestra el JSON completo que se está retornando.
-- ============================================================================

DO $$
DECLARE
  v_item_ids UUID[];
  v_tier_id UUID;
  v_result JSON;
  v_cart_id UUID;
BEGIN
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '🧪 TEST: calculate_shipping_cost_for_selected_items';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  
  -- Obtener carrito activo del usuario
  SELECT id INTO v_cart_id
  FROM b2b_carts
  WHERE buyer_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
  
  IF v_cart_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró carrito activo';
    RETURN;
  END IF;
  
  RAISE NOTICE '📦 Carrito ID: %', v_cart_id;
  RAISE NOTICE '';
  
  -- Obtener TODOS los item IDs del carrito
  SELECT array_agg(bci.id)
  INTO v_item_ids
  FROM b2b_cart_items bci
  WHERE bci.cart_id = v_cart_id;
  
  IF v_item_ids IS NULL OR array_length(v_item_ids, 1) = 0 THEN
    RAISE NOTICE '❌ No hay items en el carrito';
    RETURN;
  END IF;
  
  RAISE NOTICE '📋 Items seleccionados (%): %', array_length(v_item_ids, 1), v_item_ids;
  RAISE NOTICE '';
  
  -- Mostrar detalles de los items
  RAISE NOTICE '🔍 Detalles de items:';
  DECLARE
    v_item RECORD;
  BEGIN
    FOR v_item IN 
      SELECT 
        bci.id,
        bci.quantity,
        bci.peso_kg,
        (bci.peso_kg * bci.quantity) as peso_total,
        p.name as producto
      FROM b2b_cart_items bci
      LEFT JOIN products p ON bci.product_id = p.id
      WHERE bci.id = ANY(v_item_ids)
    LOOP
      RAISE NOTICE '  • % - qty: %, peso: % kg × % = % kg total', 
        v_item.producto, 
        v_item.quantity, 
        v_item.peso_kg,
        v_item.quantity,
        v_item.peso_total;
    END LOOP;
  END;
  RAISE NOTICE '';
  
  -- Obtener primer tier activo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE is_active = TRUE
  ORDER BY tier_name
  LIMIT 1;
  
  IF v_tier_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró tier activo';
    RETURN;
  END IF;
  
  RAISE NOTICE '✈️  Tier seleccionado: %', v_tier_id;
  
  -- Mostrar detalles del tier
  DECLARE
    v_tier RECORD;
  BEGIN
    FOR v_tier IN 
      SELECT 
        st.tier_name,
        st.custom_tier_name,
        st.tramo_a_cost_per_kg,
        st.tramo_b_cost_per_lb,
        r.origin_city,
        r.destination_country
      FROM shipping_tiers st
      LEFT JOIN routes r ON st.route_id = r.id
      WHERE st.id = v_tier_id
    LOOP
      RAISE NOTICE '  • Nombre: %', COALESCE(v_tier.custom_tier_name, v_tier.tier_name);
      RAISE NOTICE '  • Ruta: % → %', v_tier.origin_city, v_tier.destination_country;
      RAISE NOTICE '  • Tramo A: $%/kg', v_tier.tramo_a_cost_per_kg;
      RAISE NOTICE '  • Tramo B: $%/lb', v_tier.tramo_b_cost_per_lb;
    END LOOP;
  END;
  RAISE NOTICE '';
  
  -- Llamar a la función (EXACTAMENTE como lo hace el frontend)
  RAISE NOTICE '🚀 Llamando a calculate_shipping_cost_for_selected_items...';
  RAISE NOTICE '';
  
  SELECT calculate_shipping_cost_for_selected_items(
    v_item_ids,
    v_tier_id
  ) INTO v_result;
  
  -- Mostrar el JSON completo
  RAISE NOTICE '📦 RESULTADO JSON COMPLETO:';
  RAISE NOTICE '%', v_result::text;
  RAISE NOTICE '';
  
  -- Desglosar los campos importantes
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '📊 VALORES INDIVIDUALES (los que ve el frontend):';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE 'total_items: %', v_result->>'total_items';
  RAISE NOTICE 'total_weight_kg: %', v_result->>'total_weight_kg';
  RAISE NOTICE 'weight_rounded_kg: %', v_result->>'weight_rounded_kg';
  RAISE NOTICE '';
  RAISE NOTICE '💰 COSTOS:';
  RAISE NOTICE 'base_cost: $%', v_result->>'base_cost';
  RAISE NOTICE 'extra_cost: $%', v_result->>'extra_cost';
  RAISE NOTICE 'shipping_cost (TOTAL): $%', v_result->>'shipping_cost';
  RAISE NOTICE '';
  RAISE NOTICE '📝 METADATA:';
  RAISE NOTICE 'shipping_type_name: %', v_result->>'shipping_type_name';
  RAISE NOTICE 'shipping_type_display: %', v_result->>'shipping_type_display';
  RAISE NOTICE 'route_id: %', v_result->>'route_id';
  RAISE NOTICE 'shipping_type_id: %', v_result->>'shipping_type_id';
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  
  -- Verificar de dónde vienen estos valores
  RAISE NOTICE '🔬 VERIFICACIÓN MANUAL:';
  RAISE NOTICE 'Llamando directamente a calculate_shipping_cost_cart...';
  
  DECLARE
    v_total_weight NUMERIC;
    v_cart_result RECORD;
  BEGIN
    -- Calcular peso total manualmente
    SELECT SUM(peso_kg * quantity) INTO v_total_weight
    FROM b2b_cart_items
    WHERE id = ANY(v_item_ids);
    
    RAISE NOTICE 'Peso total calculado: % kg', v_total_weight;
    
    -- Llamar al motor directamente
    SELECT * INTO v_cart_result
    FROM calculate_shipping_cost_cart(
      v_total_weight,
      v_tier_id,
      FALSE
    );
    
    RAISE NOTICE '';
    RAISE NOTICE 'Resultado del motor (calculate_shipping_cost_cart):';
    RAISE NOTICE '  • base_cost: $%', v_cart_result.base_cost;
    RAISE NOTICE '  • extra_cost: $%', v_cart_result.extra_cost;
    RAISE NOTICE '  • total_cost_with_type: $%', v_cart_result.total_cost_with_type;
    RAISE NOTICE '  • weight_rounded_kg: % kg', v_cart_result.weight_rounded_kg;
    RAISE NOTICE '';
    
    -- Comparar
    IF v_cart_result.base_cost = (v_result->>'base_cost')::NUMERIC THEN
      RAISE NOTICE '✅ base_cost COINCIDE entre orquestador y motor';
    ELSE
      RAISE NOTICE '⚠️ DIFERENCIA en base_cost: motor=$% vs orquestador=$%', 
        v_cart_result.base_cost, 
        (v_result->>'base_cost')::NUMERIC;
    END IF;
    
    IF v_cart_result.total_cost_with_type = (v_result->>'shipping_cost')::NUMERIC THEN
      RAISE NOTICE '✅ total COINCIDE entre orquestador y motor';
    ELSE
      RAISE NOTICE '⚠️ DIFERENCIA en total: motor=$% vs orquestador=$%', 
        v_cart_result.total_cost_with_type, 
        (v_result->>'shipping_cost')::NUMERIC;
    END IF;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '✅ TEST COMPLETADO';
  RAISE NOTICE '==================================================================';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: % - %', SQLERRM, SQLSTATE;
END $$;
