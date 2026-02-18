-- ============================================================================
-- DEBUG: ¿De dónde vienen los $62.60 de costo de envío?
-- ============================================================================
-- 
-- Este script investiga:
-- 1. Cuánto pesan realmente los items del carrito
-- 2. Qué función se está usando para calcular el costo
-- 3. Qué tarifas se están aplicando
-- 4. Por qué 2 kg cuestan $62.60
-- ============================================================================

DO $$
DECLARE
  v_cart_id UUID;
  v_total_weight_kg NUMERIC;
  v_total_items INT;
  v_shipping_cost_view JSON;
  v_selected_tier_id UUID;
  v_item RECORD;
  v_tier RECORD;
  v_config RECORD;
  v_view_result RECORD;
  v_calc_result RECORD;
  v_weight_lb NUMERIC;
BEGIN
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '🔍 INVESTIGACIÓN: ¿De dónde vienen los $62.60?';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  
  -- ========================================================================
  -- 1. VERIFICAR ITEMS DEL CARRITO Y SUS PESOS
  -- ========================================================================
  
  RAISE NOTICE '📦 ITEMS EN EL CARRITO:';
  RAISE NOTICE '';
  
  -- Obtener carrito activo
  SELECT id INTO v_cart_id
  FROM b2b_carts
  WHERE buyer_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
  
  IF v_cart_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró carrito activo';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Carrito ID: %', v_cart_id;
  RAISE NOTICE '';
  
  -- Listar items con detalles
  FOR v_item IN 
    SELECT 
      bci.id,
      p.name as producto,
      bci.quantity,
      bci.peso_kg,
      (bci.peso_kg * bci.quantity) as peso_total_kg,
      bci.precio_b2b
    FROM b2b_cart_items bci
    LEFT JOIN products p ON bci.product_id = p.id
    WHERE bci.cart_id = v_cart_id
    ORDER BY bci.created_at
  LOOP
    RAISE NOTICE '  📦 % (qty: %)', v_item.producto, v_item.quantity;
    RAISE NOTICE '     • Peso unitario: % kg', COALESCE(v_item.peso_kg, 0);
    RAISE NOTICE '     • Peso total: % kg', COALESCE(v_item.peso_total_kg, 0);
    RAISE NOTICE '     • Precio B2B: $%', v_item.precio_b2b;
    RAISE NOTICE '';
  END LOOP;
  
  -- Calcular peso total
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(*)
  INTO v_total_weight_kg, v_total_items
  FROM b2b_cart_items bci
  WHERE bci.cart_id = v_cart_id;
  
  RAISE NOTICE '📊 RESUMEN DE PESO:';
  RAISE NOTICE '  • Total items: %', v_total_items;
  RAISE NOTICE '  • Peso total sin redondear: % kg', v_total_weight_kg;
  RAISE NOTICE '  • Peso redondeado (CEIL): % kg', CEIL(v_total_weight_kg);
  RAISE NOTICE '';
  
  -- ========================================================================
  -- 2. VERIFICAR QUÉ COSTO RETORNA v_cart_shipping_costs (VISTA)
  -- ========================================================================
  
  RAISE NOTICE '🔍 COSTO DESDE v_cart_shipping_costs (vista dinámica):';
  RAISE NOTICE '';
  
  SELECT * INTO v_view_result
  FROM v_cart_shipping_costs
  LIMIT 1;
  
  IF v_view_result IS NOT NULL THEN
    RAISE NOTICE '  • Total weight: % kg', v_view_result.total_weight_kg;
    RAISE NOTICE '  • Weight rounded: % kg', v_view_result.weight_rounded_kg;
    RAISE NOTICE '  • Base cost: $%', v_view_result.base_cost;
    RAISE NOTICE '  • Extra cost: $%', v_view_result.extra_cost;
    RAISE NOTICE '  • TOTAL COST: $%', v_view_result.total_cost_with_type;
    RAISE NOTICE '  • Shipping type: %', v_view_result.shipping_type_name;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '  ⚠️ La vista no retorna datos';
    RAISE NOTICE '';
  END IF;
  
  -- ========================================================================
  -- 3. VERIFICAR TARIFAS EN shipping_tiers (NUEVA TABLA)
  -- ========================================================================
  
  RAISE NOTICE '📋 TARIFAS ACTIVAS EN shipping_tiers:';
  RAISE NOTICE '';
  
  FOR v_tier IN
    SELECT 
      st.id,
      st.tier_name,
      st.custom_tier_name,
      st.tramo_a_cost_per_kg,
      st.tramo_b_cost_per_lb,
      st.is_active,
      r.origin_city,
      r.destination_country
    FROM shipping_tiers st
    LEFT JOIN routes r ON st.route_id = r.id
    WHERE st.is_active = TRUE
    ORDER BY st.tier_name
  LOOP
    RAISE NOTICE '  ✈️  % (%)', 
      COALESCE(v_tier.custom_tier_name, v_tier.tier_name),
      v_tier.tier_name;
    RAISE NOTICE '     • Ruta: % → %', v_tier.origin_city, v_tier.destination_country;
    RAISE NOTICE '     • Tramo A: $%/kg', v_tier.tramo_a_cost_per_kg;
    RAISE NOTICE '     • Tramo B: $%/lb', v_tier.tramo_b_cost_per_lb;
    RAISE NOTICE '     • ID: %', v_tier.id;
    
    -- Calcular costo con este tier para comparar
    v_weight_lb := CEIL(v_total_weight_kg) * 2.20462;
    
    SELECT * INTO v_calc_result
    FROM calculate_shipping_cost_cart(
      v_total_weight_kg,
      v_tier.id,
      FALSE
    );
    
    RAISE NOTICE '     • Si usas este tier para % kg:', CEIL(v_total_weight_kg);
    RAISE NOTICE '       - Tramo A: % kg × $%/kg = $%', 
      CEIL(v_total_weight_kg),
      v_tier.tramo_a_cost_per_kg,
      ROUND((CEIL(v_total_weight_kg) * v_tier.tramo_a_cost_per_kg)::NUMERIC, 2);
    RAISE NOTICE '       - Tramo B: % lb × $%/lb = $%',
      ROUND(v_weight_lb, 2),
      v_tier.tramo_b_cost_per_lb,
      ROUND((v_weight_lb * v_tier.tramo_b_cost_per_lb)::NUMERIC, 2);
    RAISE NOTICE '       - COSTO TOTAL: $%', v_calc_result.total_cost_with_type;
    RAISE NOTICE '';
  END LOOP;
  
  -- ========================================================================
  -- 4. VERIFICAR TARIFAS EN shipping_type_configs (TABLA ANTIGUA)
  -- ========================================================================
  
  RAISE NOTICE '⚠️  TARIFAS EN shipping_type_configs (SISTEMA ANTIGUO):';
  RAISE NOTICE '';
  
  FOR v_config IN
    SELECT 
      stc.id,
      stc.name,
      stc.type_key,
      stc.weight_min_kg,
      stc.weight_max_kg,
      stc.base_cost,
      stc.cost_per_kg,
      stc.is_active
    FROM shipping_type_configs stc
    WHERE stc.is_active = TRUE
      AND v_total_weight_kg >= stc.weight_min_kg
      AND (stc.weight_max_kg IS NULL OR v_total_weight_kg <= stc.weight_max_kg)
    ORDER BY stc.weight_min_kg
  LOOP
    RAISE NOTICE '  📦 % (%)', v_config.name, v_config.type_key;
    RAISE NOTICE '     • Rango: % - % kg', v_config.weight_min_kg, COALESCE(v_config.weight_max_kg::text, '∞');
    RAISE NOTICE '     • Base cost: $%', v_config.base_cost;
    RAISE NOTICE '     • Cost per kg: $%', v_config.cost_per_kg;
    RAISE NOTICE '     • Para % kg: $% + (% × $%) = $%',
      v_total_weight_kg,
      v_config.base_cost,
      v_total_weight_kg,
      v_config.cost_per_kg,
      ROUND((v_config.base_cost + (v_total_weight_kg * v_config.cost_per_kg))::NUMERIC, 2);
    RAISE NOTICE '     • ID: %', v_config.id;
    RAISE NOTICE '';
  END LOOP;
  
  -- ========================================================================
  -- 5. VERIFICAR QUÉ FUNCIÓN USA LA VISTA
  -- ========================================================================
  
  RAISE NOTICE '🔬 ANÁLISIS DE FUNCIONES:';
  RAISE NOTICE '';
  RAISE NOTICE 'La vista v_cart_shipping_costs usa: get_cart_shipping_cost()';
  RAISE NOTICE 'Esta función probablemente usa: shipping_type_configs (antiguo)';
  RAISE NOTICE '';
  RAISE NOTICE 'El frontend nuevo (useCartShippingCostView) usa:';
  RAISE NOTICE '  → calculate_shipping_cost_for_selected_items()';
  RAISE NOTICE '  → Que a su vez llama: calculate_shipping_cost_cart()';
  RAISE NOTICE '  → Que usa: shipping_tiers (nuevo sistema)';
  RAISE NOTICE '';
  
  -- ========================================================================
  -- CONCLUSIÓN
  -- ========================================================================
  
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '💡 CONCLUSIÓN:';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Para entender de dónde vienen los $62.60, verifica arriba:';
  RAISE NOTICE '';
  RAISE NOTICE '1. ¿Cuánto pesa realmente tu carrito?';
  RAISE NOTICE '2. ¿La vista v_cart_shipping_costs muestra $62.60?';
  RAISE NOTICE '3. ¿Qué tier de shipping_tiers genera ese costo?';
  RAISE NOTICE '4. ¿O viene de shipping_type_configs (antiguo)?';
  RAISE NOTICE '';
  RAISE NOTICE 'Si el costo es incorrecto:';
  RAISE NOTICE '  → Verifica las tarifas en shipping_tiers';
  RAISE NOTICE '  → Asegúrate de que los pesos estén bien configurados';
  RAISE NOTICE '  → El sistema usa CEIL() para redondear hacia arriba';
  RAISE NOTICE '  → Fórmula: (peso_kg × $/kg) + (peso_lb × $/lb)';
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: % - %', SQLERRM, SQLSTATE;
END $$;
