-- ============================================================================
-- VERIFICAR Y FORZAR ACTUALIZACIÓN DE COSTOS
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Verificar que tramo_b_cost_per_kg existe y tiene valores
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'shipping_tiers' 
    AND column_name = 'tramo_b_cost_per_kg'
  ) THEN
    RAISE NOTICE '❌ COLUMNA tramo_b_cost_per_kg NO EXISTE - Ejecuta MIGRACION_SOLO_KG_NO_LIBRAS.sql primero';
  ELSE
    RAISE NOTICE '✅ Columna tramo_b_cost_per_kg existe';
  END IF;
END $$;

-- Verificar valores actuales
SELECT 
  tier_name,
  transport_type,
  tramo_a_cost_per_kg as "Tramo A ($/kg)",
  tramo_b_cost_per_lb as "Tramo B OLD ($/lb)",
  tramo_b_cost_per_kg as "Tramo B NEW ($/kg)",
  CASE 
    WHEN tramo_b_cost_per_kg IS NULL OR tramo_b_cost_per_kg = 0 THEN '❌ FALTA VALOR'
    ELSE '✅ OK'
  END as estado
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY transport_type, tier_name;

-- ============================================================================
-- PASO 2: Asegurar que tramo_b_cost_per_kg tiene valores correctos
-- ============================================================================

-- Si hay valores NULL o 0, convertir desde tramo_b_cost_per_lb
UPDATE shipping_tiers
SET tramo_b_cost_per_kg = ROUND((tramo_b_cost_per_lb / 2.20462)::NUMERIC, 4)
WHERE (tramo_b_cost_per_kg IS NULL OR tramo_b_cost_per_kg = 0)
  AND tramo_b_cost_per_lb IS NOT NULL
  AND tramo_b_cost_per_lb > 0;

SELECT '✅ Valores actualizados' as status;

-- ============================================================================
-- PASO 3: Re-crear calculate_shipping_cost_cart para asegurar que use los valores correctos
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
  -- 1. Obtener configuración del tier (SIEMPRE LEE VALORES FRESCOS DE LA BD)
  -- ============================================================================
  
  SELECT 
    st.id,
    st.tier_name,
    COALESCE(st.custom_tier_name, st.tier_name) as display_name,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_kg,  -- ✅ USA KG (NO LIBRAS)
    st.route_id
  INTO v_tier
  FROM public.shipping_tiers st  -- ✅ LEE DIRECTAMENTE - NO HAY CACHE
  WHERE st.id = p_shipping_type_id
    AND st.is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier de envío no encontrado o inactivo: %', p_shipping_type_id;
  END IF;
  
  -- Validar que los costos no sean NULL
  IF v_tier.tramo_a_cost_per_kg IS NULL OR v_tier.tramo_b_cost_per_kg IS NULL THEN
    RAISE EXCEPTION 'Costos no configurados para tier: % (tramo_a=%, tramo_b=%)', 
      v_tier.tier_name, 
      v_tier.tramo_a_cost_per_kg,
      v_tier.tramo_b_cost_per_kg;
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
$$ LANGUAGE plpgsql STABLE;  -- ✅ STABLE permite cache dentro de la misma transacción, pero lee valores frescos

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  '✅ MOTOR DE CÁLCULO - USA SOLO KILOGRAMOS - AUTO-ACTUALIZA
  
  Lee valores DIRECTAMENTE de shipping_tiers en cada llamada.
  Cuando cambies tramo_a_cost_per_kg o tramo_b_cost_per_kg en la BD,
  esta función usará los nuevos valores automáticamente.
  
  Fórmula:
  - Tramo A: peso_kg × tramo_a_cost_per_kg
  - Tramo B: peso_kg × tramo_b_cost_per_kg
  - Base: Tramo A + Tramo B
  
  NO usa libras en el cálculo. TODO EN KG.';

SELECT '✅ Función calculate_shipping_cost_cart re-creada' as status;

-- ============================================================================
-- PASO 4: Probar con 1kg de cada tier
-- ============================================================================

SELECT 
  '✅ PRUEBA: COSTOS CON 1 KG' as test;

SELECT 
  COALESCE(st.custom_tier_name, st.tier_name) as "Tier",
  st.transport_type as "Transporte",
  st.tramo_a_cost_per_kg as "Tramo A DB ($/kg)",
  st.tramo_b_cost_per_kg as "Tramo B DB ($/kg)",
  csc.weight_rounded_kg as "Peso (kg)",
  csc.base_cost as "Costo Calculado ($)",
  csc.total_cost_with_type as "TOTAL ($)",
  CASE 
    WHEN ABS(csc.base_cost - (st.tramo_a_cost_per_kg + st.tramo_b_cost_per_kg)) < 0.01 
    THEN '✅ CORRECTO'
    ELSE '❌ ERROR: ' || (st.tramo_a_cost_per_kg + st.tramo_b_cost_per_kg)::text || ' esperado'
  END as "Verificación"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(
    1.0,      -- 1kg de prueba
    st.id,
    FALSE,
    NULL, NULL, NULL
  )
) csc
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

COMMIT;

SELECT '✅ ACTUALIZACIÓN COMPLETADA - Refresca el frontend para ver cambios' as status;
