-- ============================================================================
-- ARQUITECTURA SIMPLIFICADA: 2 FUNCIONES SOLAMENTE
-- ============================================================================
-- 
-- MOTOR (cálculo puro):
--   • calculate_shipping_cost_cart(peso, tier_id, oversize, dims)
--   → Uso: SOLO para cálculos matemáticos puros (sin acceso a BD)
--   → Ejemplo: Preview de costos, calculadora de envío
-- 
-- ORQUESTADOR (lee BD + llama motor):
--   • calculate_shipping_cost_for_selected_items(item_ids[], tier_id)
--   → Uso: SIEMPRE que tengas items guardados en la BD
--   → Ventajas: Seguridad (RLS), peso real desde BD, validación de usuario
--   → BD hace TODO: Lee peso, cantidad, calcula - NO calcular en frontend
-- 
-- ⚠️ IMPORTANTE FRONTEND:
--   • useCartShippingCostView → Usa ORQUESTADOR (correcto para carrito guardado)
--     → Solo pasa itemIds - BD calcula peso y cantidad
--     → NO calcular peso en frontend - es redundante y puede desincronizarse
--   
--   • useCartShippingCost → Usa MOTOR (solo para preview sin guardar)
--     → Requiere calcular peso en frontend porque no hay BD
--   
--   • ShippingTypeSelector → Inteligente:
--     → Si tiene itemIds → usa ORQUESTADOR (no necesita cartItems)
--     → Si NO tiene itemIds → usa MOTOR (necesita cartItems con peso)
-- 
-- TIER OBLIGATORIO - Sin fallbacks - Sin defaults
-- ============================================================================

-- ============================================================================
-- ELIMINAR TODAS LAS VERSIONES DE calculate_shipping_cost_cart
-- ============================================================================

-- Eliminar todas las sobrecargas de la función
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(NUMERIC, UUID, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart CASCADE;

-- ============================================================================
-- CREAR FUNCIÓN 1/2: MOTOR (CÁLCULO PURO)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,  -- ✅ OBLIGATORIO
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
    st.route_id,
    st.tier_name,
    COALESCE(st.custom_tier_name, st.tier_name),
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb
  INTO v_tier_route_id, v_type_name, v_type_display, v_tramo_a_cost_per_kg, v_tramo_b_cost_per_lb
  FROM public.shipping_tiers st
  WHERE st.id = p_shipping_type_id
    AND st.is_active = TRUE;
  
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
    v_tier_route_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito usando shipping_tiers. 
  LÓGICA SIMPLE: El usuario DEBE seleccionar un tipo de envío (tier).
  - p_shipping_type_id es OBLIGATORIO
  - El tier contiene su propia route_id y tarifas
  - Sin tier → error (no calcular)
  Usa costos separados: tramo A ($/kg) y tramo B ($/lb). Incluye surcharges por oversize/dimensiones.';

-- ============================================================================
-- CREAR FUNCIÓN 2/2: ORQUESTADOR (LEE BD + LLAMA MOTOR)
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_shipping_cost_for_selected_items CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[],
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total_items INT;
  v_total_weight NUMERIC;
  v_shipping_cost JSON;
  v_current_user_id UUID;
BEGIN
  -- ============================================================================
  -- SEGURIDAD: Validar que los items pertenecen al usuario actual
  -- ============================================================================
  
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Calcular peso total de los items seleccionados
  -- ✅ IMPORTANTE: Filtrar por buyer_user_id para evitar acceso a carritos ajenos
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(DISTINCT bci.id)
  INTO v_total_weight, v_total_items
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.id = ANY(p_item_ids)
    AND bc.buyer_user_id = v_current_user_id;  -- ✅ Filtro de seguridad

  -- Si no se encontraron items, retornar error
  IF v_total_items = 0 THEN
    RETURN json_build_object(
      'shipping_cost', 0,
      'total_items', 0,
      'total_weight_kg', 0,
      'message', 'no_items_found'
    );
  END IF;

  -- Si no hay peso, retornar cero
  IF v_total_weight = 0 OR v_total_weight IS NULL THEN
    RETURN json_build_object(
      'shipping_cost', 0,
      'total_items', v_total_items,
      'total_weight_kg', 0,
      'message', 'no_weight_available'
    );
  END IF;

  -- ============================================================================
  -- Validar que se seleccionó un tipo de envío
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    RETURN json_build_object(
      'shipping_cost', null,
      'total_items', v_total_items,
      'total_weight_kg', v_total_weight,
      'message', 'no_shipping_type_selected',
      'error', 'El usuario debe seleccionar un tipo de envío'
    );
  END IF;

  -- Calcular costo usando la función principal
  SELECT 
    json_build_object(
      'shipping_cost', resultado.total_cost_with_type,
      'weight_rounded_kg', resultado.weight_rounded_kg,
      'base_cost', resultado.base_cost,
      'oversize_surcharge', resultado.oversize_surcharge,
      'dimensional_surcharge', resultado.dimensional_surcharge,
      'extra_cost', resultado.extra_cost,
      'shipping_type_name', resultado.shipping_type_name,
      'shipping_type_display', resultado.shipping_type_display,
      'volume_m3', resultado.volume_m3,
      'route_id', resultado.route_id,
      'message', 'calculated_from_shipping_tiers'
    )
  INTO v_shipping_cost
  FROM public.calculate_shipping_cost_cart(
    v_total_weight,         -- Peso
    p_shipping_type_id,     -- Tier (obligatorio)
    FALSE                   -- oversize
  ) as resultado;

  -- Retornar resultado
  RETURN json_build_object(
    'total_items', v_total_items,
    'total_weight_kg', ROUND(v_total_weight, 3),
    'weight_rounded_kg', ROUND((v_shipping_cost->>'weight_rounded_kg')::NUMERIC, 2),
    'shipping_cost', ROUND((v_shipping_cost->>'shipping_cost')::NUMERIC, 2),
    'base_cost', ROUND((v_shipping_cost->>'base_cost')::NUMERIC, 2),
    'extra_cost', ROUND((v_shipping_cost->>'extra_cost')::NUMERIC, 2),
    'shipping_type_name', v_shipping_cost->>'shipping_type_name',
    'shipping_type_display', v_shipping_cost->>'shipping_type_display',
    'route_id', (v_shipping_cost->>'route_id')::UUID,
    'shipping_type_id', p_shipping_type_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_for_selected_items IS 
  'Calcula el costo de envío para items seleccionados del carrito.
  REQUIERE que se seleccione un tipo de envío (p_shipping_type_id).
  Sin tier → retorna error.
  Usa shipping_tiers (no shipping_type_configs).
  
  SEGURIDAD: Valida que los items pertenezcan al usuario autenticado (auth.uid()).
  Un usuario solo puede calcular costos de sus propios items.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Test: Ver si hay tiers activos
SELECT 
  '✅ Tiers disponibles:' as info,
  id,
  tier_name,
  custom_tier_name,
  route_id,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  is_active
FROM shipping_tiers
WHERE is_active = TRUE
LIMIT 5;

-- Test: Calcular con tier específico
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
    
    RAISE NOTICE '✅ Costo calculado = $% para tier %', 
      v_result.total_cost_with_type, 
      v_result.shipping_type_name;
  ELSE
    RAISE WARNING '⚠️ No hay tiers activos en la base de datos';
  END IF;
END $$;

SELECT '✅ FUNCIONES ACTUALIZADAS CORRECTAMENTE' as status;
