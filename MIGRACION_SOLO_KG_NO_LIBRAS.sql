-- ============================================================================
-- MIGRACIÓN: ELIMINAR LIBRAS - USAR SOLO KILOGRAMOS
-- ============================================================================
-- PROBLEMA: 
-- - tramo_b_cost_per_lb causa doble conversión (×2.20462 dos veces)
-- - Valores inflados incorrectamente
-- 
-- SOLUCIÓN:
-- - Cambiar todo a KG
-- - tramo_a_cost_per_kg: sigue igual
-- - tramo_b_cost_per_kg: nueva columna (conversión desde _per_lb)
-- - Fórmula: base_cost = (peso_kg × tramo_a) + (peso_kg × tramo_b)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Agregar nueva columna tramo_b_cost_per_kg
-- ============================================================================

ALTER TABLE shipping_tiers 
ADD COLUMN IF NOT EXISTS tramo_b_cost_per_kg NUMERIC(10, 4) DEFAULT 0;

COMMENT ON COLUMN shipping_tiers.tramo_b_cost_per_kg IS 
  'Costo por kg del Tramo B (destino local). TODO EN KG.';

-- ============================================================================
-- PASO 2: Convertir valores existentes de lb a kg
-- ============================================================================
-- Fórmula: $/kg = $/lb ÷ 2.20462
-- Ejemplo: $11.0231/lb ÷ 2.20462 = $5.00/kg

UPDATE shipping_tiers
SET tramo_b_cost_per_kg = ROUND((tramo_b_cost_per_lb / 2.20462)::NUMERIC, 4)
WHERE tramo_b_cost_per_lb IS NOT NULL;

-- ============================================================================
-- PASO 3: Verificar conversión
-- ============================================================================

SELECT 
  tier_name,
  transport_type,
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B OLD ($/lb)",
  tramo_b_cost_per_kg as "Tramo B NEW ($/kg)",
  '✅' as conversion_ok
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY transport_type, tier_name;

-- ============================================================================
-- PASO 4: Actualizar calculate_shipping_cost_cart (SOLO KG)
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  total_items INTEGER,
  total_weight_kg NUMERIC,
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  volume_m3 NUMERIC,
  route_id UUID
) AS $$
DECLARE
  v_tier RECORD;
  v_weight_rounded NUMERIC;
  v_tramo_a_cost NUMERIC := 0;
  v_tramo_b_cost NUMERIC := 0;
  v_base_cost NUMERIC := 0;
  v_oversize_cost NUMERIC := 0;
  v_dimensional_cost NUMERIC := 0;
  v_volume NUMERIC := 0;
BEGIN
  -- ============================================================================
  -- 1. Obtener configuración del tier
  -- ============================================================================
  
  SELECT 
    st.id,
    st.tier_name,
    COALESCE(st.custom_tier_name, st.tier_name) as display_name,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_kg,  -- ✅ AHORA USA KG
    st.route_id
  INTO v_tier
  FROM public.shipping_tiers st
  WHERE st.id = p_shipping_type_id
    AND st.is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier de envío no encontrado o inactivo: %', p_shipping_type_id;
  END IF;
  
  -- ============================================================================
  -- 2. Redondear peso (CEIL)
  -- ============================================================================
  
  v_weight_rounded := CEIL(p_total_weight_kg);
  
  -- ============================================================================
  -- 3. CALCULAR BASE COST - TODO EN KG
  -- ============================================================================
  
  -- Tramo A: China → Puerto (en kg)
  v_tramo_a_cost := v_weight_rounded * v_tier.tramo_a_cost_per_kg;
  
  -- Tramo B: Puerto → Destino (en kg) ✅ NO MÁS LIBRAS
  v_tramo_b_cost := v_weight_rounded * v_tier.tramo_b_cost_per_kg;
  
  -- Total base
  v_base_cost := v_tramo_a_cost + v_tramo_b_cost;
  
  -- ============================================================================
  -- 4. Calcular recargos (oversize, dimensional)
  -- ============================================================================
  
  -- Recargo por oversize (+15% del costo base)
  IF p_is_oversize THEN
    v_oversize_cost := v_base_cost * 0.15;
  END IF;
  
  -- Recargo por peso dimensional (si aplica)
  IF p_length_cm IS NOT NULL AND p_width_cm IS NOT NULL AND p_height_cm IS NOT NULL THEN
    v_volume := (p_length_cm * p_width_cm * p_height_cm) / 1000000.0; -- m³
    
    -- Si volumen > 0.15 m³, aplicar recargo de 10%
    IF v_volume > 0.15 THEN
      v_dimensional_cost := v_base_cost * 0.10;
    END IF;
  END IF;
  
  -- ============================================================================
  -- 5. Retornar resultado
  -- ============================================================================
  
  RETURN QUERY SELECT
    1 as total_items,
    p_total_weight_kg as total_weight_kg,
    v_weight_rounded as weight_rounded_kg,
    v_base_cost as base_cost,
    v_oversize_cost as oversize_surcharge,
    v_dimensional_cost as dimensional_surcharge,
    (v_oversize_cost + v_dimensional_cost) as extra_cost,
    (v_base_cost + v_oversize_cost + v_dimensional_cost) as total_cost_with_type,
    v_tier.tier_name as shipping_type_name,
    v_tier.display_name as shipping_type_display,
    v_volume as volume_m3,
    v_tier.route_id as route_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  '✅ MOTOR DE CÁLCULO - USA SOLO KILOGRAMOS
  
  Fórmula simplificada:
  - Tramo A: peso_kg × tramo_a_cost_per_kg
  - Tramo B: peso_kg × tramo_b_cost_per_kg
  - Base: Tramo A + Tramo B
  
  NO usa libras. Todo en kg.';

-- ============================================================================
-- PASO 5: Eliminar columna antigua (OPCIONAL - comentar si prefieres mantenerla)
-- ============================================================================

-- DESCOMENTAR CUANDO ESTÉS SEGURO:
-- ALTER TABLE shipping_tiers DROP COLUMN IF EXISTS tramo_b_cost_per_lb;

-- ============================================================================
-- PASO 6: Verificar que funcione
-- ============================================================================

SELECT 
  '✅ VERIFICACIÓN: Cálculo para 2kg con cada tier' as test;

SELECT 
  COALESCE(st.custom_tier_name, st.tier_name) as "Tier",
  st.transport_type as "Transporte",
  st.tramo_a_cost_per_kg as "Tramo A ($/kg)",
  st.tramo_b_cost_per_kg as "Tramo B ($/kg)",
  csc.weight_rounded_kg as "Peso (kg)",
  csc.base_cost as "Costo Base ($)",
  csc.extra_cost as "Extras ($)",
  csc.total_cost_with_type as "TOTAL ($)"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(
    2.0,      -- 2kg de prueba
    st.id,
    FALSE,
    NULL, NULL, NULL
  )
) csc
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

-- ============================================================================
-- RESULTADOS ESPERADOS:
-- ============================================================================
-- Express aéreo (2kg):
--   Tramo A: 2 × $7.00 = $14.00
--   Tramo B: 2 × $5.00 = $10.00
--   TOTAL: $24.00 ✅ (antes era $62.60)
--
-- Marítimo Estándar (2kg):
--   Tramo A: 2 × $2.30 = $4.60
--   Tramo B: 2 × $3.00 = $6.00
--   TOTAL: $10.60 ✅ (antes era $33.76)
-- ============================================================================

COMMIT;

SELECT '✅ MIGRACIÓN COMPLETADA - TODO AHORA USA KILOGRAMOS' as status;
