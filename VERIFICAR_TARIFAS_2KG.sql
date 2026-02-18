-- ============================================================================
-- VERIFICAR TARIFAS EXACTAS EN shipping_tiers
-- ============================================================================

SELECT 
  st.id,
  st.tier_name,
  st.custom_tier_name,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.is_active,
  st.route_id,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max
FROM shipping_tiers st
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

-- ============================================================================
-- CALCULAR EXACTAMENTE EL COSTO PARA 2 KG
-- ============================================================================

DO $$
DECLARE
  v_tier RECORD;
  v_peso_kg NUMERIC := 2.0;
  v_peso_lb NUMERIC;
  v_tramo_a NUMERIC;
  v_tramo_b NUMERIC;
  v_total NUMERIC;
BEGIN
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '💰 CÁLCULO DE COSTO DE ENVÍO PARA 2 KG';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  
  -- Redondear peso (CEIL)
  v_peso_kg := CEIL(v_peso_kg);
  
  -- Convertir a libras
  v_peso_lb := v_peso_kg * 2.20462;
  
  RAISE NOTICE '📦 PESO:';
  RAISE NOTICE '  • Peso original: 2.0 kg';
  RAISE NOTICE '  • Peso redondeado (CEIL): % kg', v_peso_kg;
  RAISE NOTICE '  • Peso en libras: % lb', ROUND(v_peso_lb, 4);
  RAISE NOTICE '';
  
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '📊 TARIFAS Y CÁLCULOS POR TIER:';
  RAISE NOTICE '==================================================================';
  
  FOR v_tier IN
    SELECT 
      st.id,
      st.tier_name,
      st.custom_tier_name,
      st.transport_type,
      st.tramo_a_cost_per_kg,
      st.tramo_b_cost_per_lb,
      st.is_active
    FROM shipping_tiers st
    WHERE st.is_active = TRUE
    ORDER BY st.transport_type, st.tier_name
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '✈️  % (%) - %', 
      COALESCE(v_tier.custom_tier_name, v_tier.tier_name),
      v_tier.transport_type,
      v_tier.tier_name;
    RAISE NOTICE '';
    RAISE NOTICE '  📋 TARIFAS EN LA BASE DE DATOS:';
    RAISE NOTICE '     • Tramo A: $%/kg', v_tier.tramo_a_cost_per_kg;
    RAISE NOTICE '     • Tramo B: $%/lb', v_tier.tramo_b_cost_per_lb;
    RAISE NOTICE '';
    
    -- Calcular costos
    v_tramo_a := v_peso_kg * v_tier.tramo_a_cost_per_kg;
    v_tramo_b := v_peso_lb * v_tier.tramo_b_cost_per_lb;
    v_total := v_tramo_a + v_tramo_b;
    
    RAISE NOTICE '  🧮 CÁLCULO PASO POR PASO:';
    RAISE NOTICE '     • Tramo A: % kg × $%/kg = $%', 
      v_peso_kg, 
      v_tier.tramo_a_cost_per_kg, 
      ROUND(v_tramo_a, 2);
    RAISE NOTICE '     • Tramo B: % lb × $%/lb = $%', 
      ROUND(v_peso_lb, 4), 
      v_tier.tramo_b_cost_per_lb, 
      ROUND(v_tramo_b, 2);
    RAISE NOTICE '';
    RAISE NOTICE '  💰 TOTAL: $% + $% = $%', 
      ROUND(v_tramo_a, 2),
      ROUND(v_tramo_b, 2),
      ROUND(v_total, 2);
    RAISE NOTICE '';
    RAISE NOTICE '  -----------------------------------------------------------';
    
    -- Verificar con la función real
    DECLARE
      v_result RECORD;
    BEGIN
      SELECT * INTO v_result
      FROM calculate_shipping_cost_cart(
        2.0,           -- peso
        v_tier.id,     -- tier_id
        FALSE,         -- oversize
        NULL, NULL, NULL  -- dimensiones
      );
      
      RAISE NOTICE '  ✅ VERIFICACIÓN CON FUNCIÓN calculate_shipping_cost_cart:';
      RAISE NOTICE '     • Base cost: $%', v_result.base_cost;
      RAISE NOTICE '     • Extra cost: $%', v_result.extra_cost;
      RAISE NOTICE '     • TOTAL: $%', v_result.total_cost_with_type;
      
      IF ROUND(v_result.total_cost_with_type, 2) = ROUND(v_total, 2) THEN
        RAISE NOTICE '     ✅ COINCIDE con cálculo manual';
      ELSE
        RAISE NOTICE '     ⚠️ DIFERENCIA: manual=$% vs función=$%', 
          ROUND(v_total, 2),
          ROUND(v_result.total_cost_with_type, 2);
      END IF;
    END;
    
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '❓ Si ves $62.60 en el UI pero aquí sale diferente:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Verifica que las tarifas arriba coincidan con la imagen';
  RAISE NOTICE '2. Verifica tramo_b_cost_per_lb - debe estar en $/LIBRA, no $/kg';
  RAISE NOTICE '3. Verifica cuántos items hay en el carrito (puede ser más de 2kg)';
  RAISE NOTICE '4. Ejecuta DEBUG_SHIPPING_COST_SOURCE.sql para ver tu carrito real';
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
END $$;

-- ============================================================================
-- MOSTRAR CONVERSIÓN $/kg → $/lb
-- ============================================================================

SELECT 
  tier_name,
  tramo_a_cost_per_kg as tramo_a_per_kg,
  tramo_b_cost_per_lb as tramo_b_per_lb_stored,
  ROUND((tramo_b_cost_per_lb / 2.20462)::NUMERIC, 4) as tramo_b_per_kg_equivalente,
  '¿Está correcto?' as nota
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY transport_type, tier_name;
