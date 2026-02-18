-- ============================================================================
-- DEBUG: De dónde sale el costo base y total de $62.60
-- ============================================================================
-- 
-- Este script muestra EXACTAMENTE cómo se calculó el costo de envío
-- mostrando:
-- 1. El tier seleccionado y sus tarifas
-- 2. El peso del carrito
-- 3. El cálculo paso por paso
-- ============================================================================

-- Ver qué tier se está usando y sus costos
SELECT 
  st.id,
  st.tier_name,
  st.custom_tier_name,
  st.route_id,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.is_active,
  r.origin_city,
  r.destination_country
FROM shipping_tiers st
LEFT JOIN routes r ON st.route_id = r.id
WHERE st.is_active = TRUE
ORDER BY st.tier_name;

-- ============================================================================
-- Calcular el costo de tu carrito con detalles paso por paso
-- ============================================================================

DO $$
DECLARE
  v_cart_id UUID;
  v_tier_id UUID;
  v_total_weight NUMERIC;
  v_weight_rounded NUMERIC;
  v_weight_lb NUMERIC;
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_tramo_a_cost_per_kg NUMERIC;
  v_tramo_b_cost_per_lb NUMERIC;
  v_base_cost NUMERIC;
  v_tier_name TEXT;
BEGIN
  -- Obtener tu carrito activo
  SELECT id INTO v_cart_id
  FROM b2b_carts
  WHERE buyer_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
  
  IF v_cart_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró carrito activo';
    RETURN;
  END IF;
  
  -- Calcular peso total de items en el carrito
  SELECT COALESCE(SUM(peso_kg * quantity), 0)
  INTO v_total_weight
  FROM b2b_cart_items
  WHERE cart_id = v_cart_id;
  
  -- Obtener el tier que estás usando (el primero activo por ahora)
  SELECT id, tier_name, tramo_a_cost_per_kg, tramo_b_cost_per_lb
  INTO v_tier_id, v_tier_name, v_tramo_a_cost_per_kg, v_tramo_b_cost_per_lb
  FROM shipping_tiers
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_tier_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró tier activo';
    RETURN;
  END IF;
  
  -- Redondear peso a superior (CEIL)
  v_weight_rounded := CEIL(v_total_weight);
  
  -- Convertir a libras para tramo B
  v_weight_lb := v_weight_rounded * 2.20462;
  
  -- Calcular costos por tramo
  v_tramo_a_cost := v_weight_rounded * v_tramo_a_cost_per_kg;
  v_tramo_b_cost := v_weight_lb * v_tramo_b_cost_per_lb;
  
  -- Calcular costo base total
  v_base_cost := v_tramo_a_cost + v_tramo_b_cost;
  
  -- Mostrar el desglose completo
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '🔍 DESGLOSE DEL CÁLCULO DE COSTO DE ENVÍO';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 Carrito ID: %', v_cart_id;
  RAISE NOTICE '✈️  Tier seleccionado: % (%)', v_tier_name, v_tier_id;
  RAISE NOTICE '';
  RAISE NOTICE '⚖️  PESO:';
  RAISE NOTICE '   • Peso total sin redondear: % kg', ROUND(v_total_weight, 3);
  RAISE NOTICE '   • Peso redondeado (CEIL): % kg', v_weight_rounded;
  RAISE NOTICE '   • Peso en libras: % lb', ROUND(v_weight_lb, 2);
  RAISE NOTICE '';
  RAISE NOTICE '💰 TARIFAS DEL TIER:';
  RAISE NOTICE '   • Tramo A: $% por kg', v_tramo_a_cost_per_kg;
  RAISE NOTICE '   • Tramo B: $% por lb', v_tramo_b_cost_per_lb;
  RAISE NOTICE '';
  RAISE NOTICE '🧮 CÁLCULO:';
  RAISE NOTICE '   • Tramo A: % kg × $%/kg = $%', v_weight_rounded, v_tramo_a_cost_per_kg, ROUND(v_tramo_a_cost, 2);
  RAISE NOTICE '   • Tramo B: % lb × $%/lb = $%', ROUND(v_weight_lb, 2), v_tramo_b_cost_per_lb, ROUND(v_tramo_b_cost, 2);
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESULTADO:';
  RAISE NOTICE '   • Costo Base = Tramo A + Tramo B';
  RAISE NOTICE '   • Costo Base = $% + $% = $%', ROUND(v_tramo_a_cost, 2), ROUND(v_tramo_b_cost, 2), ROUND(v_base_cost, 2);
  RAISE NOTICE '   • Extra Cost (surcharges) = $0.00';
  RAISE NOTICE '   • TOTAL = $%', ROUND(v_base_cost, 2);
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
  
  -- Comparar con la función real
  RAISE NOTICE '';
  RAISE NOTICE '🔬 VERIFICACIÓN CON FUNCIÓN OFICIAL:';
  
  DECLARE
    v_result RECORD;
  BEGIN
    SELECT * INTO v_result
    FROM calculate_shipping_cost_cart(
      v_total_weight,
      v_tier_id,
      FALSE  -- no oversize
    );
    
    RAISE NOTICE '   • Base cost: $%', v_result.base_cost;
    RAISE NOTICE '   • Extra cost: $%', v_result.extra_cost;
    RAISE NOTICE '   • Total: $%', v_result.total_cost_with_type;
    RAISE NOTICE '';
    
    IF ROUND(v_result.total_cost_with_type, 2) = ROUND(v_base_cost, 2) THEN
      RAISE NOTICE '✅ ¡Los cálculos coinciden perfectamente!';
    ELSE
      RAISE NOTICE '⚠️ Diferencia detectada: $% vs $%', 
        ROUND(v_result.total_cost_with_type, 2), 
        ROUND(v_base_cost, 2);
    END IF;
  END;
END $$;

-- ============================================================================
-- Ver los items del carrito y sus pesos
-- ============================================================================

SELECT 
  'Items en el carrito:' as info,
  bci.id,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total_item,
  p.name as producto
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
LEFT JOIN products p ON bci.product_id = p.id
WHERE bc.buyer_user_id = auth.uid()
  AND bc.status = 'active'
ORDER BY bci.created_at;
