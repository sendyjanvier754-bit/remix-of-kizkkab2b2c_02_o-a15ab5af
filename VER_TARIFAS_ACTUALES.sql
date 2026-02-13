-- =============================================================================
-- VER TARIFAS ACTUALES DEL MÓDULO DE LOGÍSTICA GLOBAL
-- =============================================================================

-- 1. Ver todas las tarifas configuradas
SELECT 
  '📊 TARIFAS EN SHIPPING_TIERS' as seccion,
  tier_type as "Tipo",
  tier_name as "Nombre",
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)",
  is_active as "Activo"
FROM shipping_tiers
ORDER BY tier_type;

-- 2. Ver específicamente la tarifa STANDARD (la que usa el carrito B2B)
SELECT 
  '🎯 TARIFA STANDARD (usada por carrito B2B)' as seccion,
  tier_type,
  tier_name,
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B ($/lb)",
  CASE 
    WHEN is_active THEN '✅ Activa'
    ELSE '❌ Inactiva'
  END as estado
FROM shipping_tiers
WHERE tier_type = 'standard'
LIMIT 1;

-- 3. Calcular un ejemplo: ¿Cuánto cuesta enviar 1 kg?
DO $$
DECLARE
  v_tramo_a NUMERIC;
  v_tramo_b NUMERIC;
  v_peso_kg NUMERIC := 1;
  v_peso_lb NUMERIC;
  v_costo NUMERIC;
BEGIN
  SELECT tramo_a_cost_per_kg, tramo_b_cost_per_lb
  INTO v_tramo_a, v_tramo_b
  FROM shipping_tiers
  WHERE tier_type = 'standard' AND is_active = TRUE
  LIMIT 1;

  IF v_tramo_a IS NOT NULL THEN
    v_peso_lb := v_peso_kg * 2.20462;
    v_costo := (v_peso_kg * v_tramo_a) + (v_peso_lb * v_tramo_b);
    
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '💰 EJEMPLO: Costo de enviar 1 kg';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE 'Peso: % kg (% lb)', v_peso_kg, ROUND(v_peso_lb, 2);
    RAISE NOTICE 'Tramo A: % kg × $% = $%', v_peso_kg, v_tramo_a, ROUND(v_peso_kg * v_tramo_a, 2);
    RAISE NOTICE 'Tramo B: % lb × $% = $%', ROUND(v_peso_lb, 2), v_tramo_b, ROUND(v_peso_lb * v_tramo_b, 2);
    RAISE NOTICE 'TOTAL: $%', ROUND(v_costo, 2);
    RAISE NOTICE '═══════════════════════════════════════';
  ELSE
    RAISE NOTICE '❌ No hay tarifas configuradas en shipping_tiers';
    RAISE NOTICE 'Se usará fallback: Tramo A = $4.00/kg, Tramo B = $2.50/lb';
  END IF;
END $$;

-- 4. Si NO hay tarifas, mostrar mensaje
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO HAY TARIFAS CONFIGURADAS'
    ELSE '✅ Tarifas encontradas: ' || COUNT(*)::text
  END as estado
FROM shipping_tiers
WHERE is_active = TRUE;
