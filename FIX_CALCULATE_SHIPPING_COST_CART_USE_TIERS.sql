-- ============================================================================
-- ACTUALIZAR FUNCIÓN calculate_shipping_cost_cart PARA USAR SHIPPING_TIERS
-- ============================================================================
-- 
-- LÓGICA SIMPLE:
-- ✅ Si el usuario seleccionó un tier → calcular costo con ese tier
-- ❌ Si NO seleccionó tier → NO calcular (retornar NULL)
-- 
-- NO HAY FALLBACKS. El usuario DEBE seleccionar un tipo de envío.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,  -- ✅ OBLIGATORIO (sin DEFAULT NULL)
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
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
  v_tramo_a_cost_per_kg NUMERIC;
  v_tramo_b_cost_per_lb NUMERIC;
  v_base_cost NUMERIC;
  v_extra_cost NUMERIC := 0;
  v_type_name VARCHAR;
  v_type_display VARCHAR;
  v_weight_rounded NUMERIC;
  v_oversize_surcharge NUMERIC := 0;
  v_dimensional_surcharge NUMERIC := 0;
  v_volume_m3 NUMERIC := 0;
  v_weight_lb NUMERIC;
  v_tier_route_id UUID;
BEGIN
  -- ============================================================================
  -- Validar que se proporcionó un tipo de envío
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    RAISE EXCEPTION 'shipping_type_id es obligatorio. El usuario debe seleccionar un tipo de envío.';
  END IF;

  -- Redondear peso a superior (CEIL)
  v_weight_rounded := CEIL(p_total_weight_kg);
  
  -- Convertir a libras para tramo B
  v_weight_lb := v_weight_rounded * 2.20462;

  -- ============================================================================
  -- Obtener tier seleccionado (contiene route_id y tarifas)
  -- ============================================================================
  
  SELECT 
    route_id,
    tier_name,
    COALESCE(custom_tier_name, tier_name),
    tramo_a_cost_per_kg,
    tramo_b_cost_per_lb
  INTO v_tier_route_id, v_type_name, v_type_display, v_tramo_a_cost_per_kg, v_tramo_b_cost_per_lb
  FROM public.shipping_tiers
  WHERE id = p_shipping_type_id
    AND is_active = TRUE;
  
  -- Si no se encontró el tier, error
  IF v_tramo_a_cost_per_kg IS NULL OR v_tramo_b_cost_per_lb IS NULL THEN
    RAISE EXCEPTION 'Tier de envío no encontrado o inactivo: %', p_shipping_type_id;
  END IF;

  -- Calcular costo base:
  -- Tramo A: peso en kg × costo por kg
  -- Tramo B: peso en lb × costo por lb
  v_base_cost := (v_weight_rounded * v_tramo_a_cost_per_kg) + (v_weight_lb * v_tramo_b_cost_per_lb);

  -- ============================================================================
  -- Surcharges por oversize y dimensiones
  -- ============================================================================

  -- 1. Aplicar surcharge si es oversize (+15% del costo base)
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- 2. Calcular surcharge por volumen si las dimensiones están disponibles
  IF p_length_cm IS NOT NULL 
     AND p_width_cm IS NOT NULL 
     AND p_height_cm IS NOT NULL THEN
    
    -- Calcular volumen en metros cúbicos
    v_volume_m3 := ROUND((p_length_cm * p_width_cm * p_height_cm / 1000000.0)::NUMERIC, 6);
    
    -- Aplicar surcharge si volumen > 0.15 m³ (+10% del costo base)
    IF v_volume_m3 > 0.15 THEN
      v_dimensional_surcharge := ROUND((v_base_cost * 0.10)::NUMERIC, 2);
    END IF;
  END IF;

  -- Extra cost es la suma de surcharges
  v_extra_cost := v_oversize_surcharge + v_dimensional_surcharge;

  RETURN QUERY SELECT 
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    v_oversize_surcharge,
    v_dimensional_surcharge,
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost)::NUMERIC, 2),
    v_type_name,
    v_type_display,
    v_volume_m3,
    v_tier_route_id;  -- ✅ Retornar route_id del tier
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito usando shipping_tiers. 
  LÓGICA SIMPLE: El usuario DEBE seleccionar un tipo de envío (tier).
  - p_shipping_type_id es OBLIGATORIO
  - El tier contiene su propia route_id y tarifas
  - Sin tier → error (no calcular)
  - Sin fallbacks ni valores por defecto
  Usa costos separados: tramo A ($/kg) y tramo B ($/lb). Incluye surcharges por oversize/dimensiones.';

-- ============================================================================
-- VERIFICAR LA FUNCIÓN
-- ============================================================================

-- Test 1: Error si NO se proporciona tier (debe fallar)
DO $$
BEGIN
  PERFORM * FROM calculate_shipping_cost_cart(
    2.5,  -- Peso
    NULL  -- ❌ Sin tier (debe lanzar error)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✅ Test 1 OK: Error esperado cuando no hay tier → %', SQLERRM;
END $$;

-- Test 2: Calcular con tier específico (debe funcionar)
DO $$
DECLARE
  v_tier_id UUID;
  v_result RECORD;
BEGIN
  -- Obtener un tier activo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_tier_id IS NOT NULL THEN
    -- Calcular con tier válido
    SELECT * INTO v_result
    FROM calculate_shipping_cost_cart(
      2.5,       -- Peso: 2.5 kg → redondea a 3 kg
      v_tier_id, -- ✅ Tier seleccionado
      FALSE      -- No oversize
    );
    
    RAISE NOTICE '✅ Test 2 OK: Costo calculado = $% para tier %', 
      v_result.total_cost_with_type, 
      v_result.shipping_type_name;
  ELSE
    RAISE WARNING '⚠️ No hay tiers activos en la base de datos';
  END IF;
END $$;

-- Test 3: Error si tier no existe (debe fallar)
DO $$
DECLARE
  v_fake_tier_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM * FROM calculate_shipping_cost_cart(
    2.5,            -- Peso
    v_fake_tier_id  -- ❌ Tier que no existe
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✅ Test 3 OK: Error esperado para tier inexistente → %', SQLERRM;
END $$;
