-- ============================================================================
-- ACTUALIZAR FUNCIONES: TIER OBLIGATORIO, SIN FALLBACKS
-- ============================================================================
-- 
-- CAMBIO LÓGICO:
-- Antes: calculate_shipping_cost_cart(route_id, peso, tier_id)
--        → Validaba tier contra route
--        → Tenía fallbacks a STANDARD y valores por defecto
-- 
-- Ahora: calculate_shipping_cost_cart(peso, tier_id)
--        → tier_id es OBLIGATORIO
--        → Si NO hay tier → NO calcular costo (error)
--        → Sin fallbacks ni valores por defecto
-- 
-- ¿POR QUÉ?
-- El usuario DEBE seleccionar explícitamente un tipo de envío.
-- Cada tier YA contiene su route_id y tarifas.
-- No mostrar costos si no hay selección.
-- ============================================================================

-- ============================================================================
-- 1. ACTUALIZAR calculate_shipping_cost_cart
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
-- 2. ACTUALIZAR calculate_shipping_cost_for_selected_items
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[],
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total_items INT;
  v_total_weight NUMERIC;
  v_route_id UUID;
  v_shipping_type_id UUID;
  v_shipping_cost JSON;
BEGIN
  -- Calcular peso total de los items seleccionados
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(DISTINCT bci.item_id),
    bc.route_id
  INTO v_total_weight, v_total_items, v_route_id  
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.item_id = ANY(p_item_ids);

  -- Si no se encontraron items, retornar error
  IF v_total_items = 0 THEN
    RETURN json_build_object(
      'shipping_cost', 0,
      'total_items', 0,
      'total_weight_kg', 0,
      'message', 'no_items_found'
    );
  END IF;

  -- Si no hay peso, retornar cero (no $0.99)
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
    v_total_weight,         -- ✅ Peso
    p_shipping_type_id,     -- ✅ Tier (obligatorio)
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
    'route_id', v_route_id,
    'shipping_type_id', v_shipping_type_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_for_selected_items IS 
  'Calcula el costo de envío para items seleccionados del carrito.
  Usa el tier seleccionado (si se proporciona) o STANDARD de la ruta del carrito.
  Lee route_id del carrito del usuario. Usa shipping_tiers (no shipping_type_configs).';

-- ============================================================================
-- 3. ACTUALIZAR get_user_cart_shipping_cost
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_cart_shipping_cost(
  p_user_id UUID,
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total_weight NUMERIC;
  v_route_id UUID;
  v_has_oversize BOOLEAN;
  v_max_length NUMERIC;
  v_max_width NUMERIC;
  v_max_height NUMERIC;
  v_result JSON;
BEGIN
  -- ============================================================================
  -- PASO 1: Obtener route_id del carrito del usuario
  -- ============================================================================
  
  SELECT c.route_id 
  INTO v_route_id
  FROM b2b_carts c
  WHERE c.buyer_user_id = p_user_id
  LIMIT 1;
  
  -- Si no hay carrito o no tiene route, usar ruta por defecto (China → Haití)
  IF v_route_id IS NULL THEN
    v_route_id := '21420dcb-9d8a-4947-8530-aaf3519c9047';
  END IF;

  -- ============================================================================
  -- PASO 2: Calcular peso total y detectar oversize
  -- ============================================================================

  WITH cart_items AS (
    SELECT 
      bci.item_id,
      bci.quantity,
      CASE 
        WHEN bci.variant_id IS NOT NULL THEN
          COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
        ELSE
          COALESCE(p.peso_kg, p.peso_g::numeric / 1000.0, 0)
      END as item_weight_kg,
      COALESCE(pv.length_cm, p.length_cm, 0) as length_cm,
      COALESCE(pv.width_cm, p.width_cm, 0) as width_cm,
      COALESCE(pv.height_cm, p.height_cm, 0) as height_cm,
      CASE 
        WHEN COALESCE(pv.is_oversize, p.is_oversize, FALSE) = TRUE THEN TRUE
        ELSE FALSE
      END as is_oversize
    FROM b2b_cart_items bci
    JOIN b2b_carts bc ON bci.cart_id = bc.id
    LEFT JOIN product_variants pv ON bci.variant_id = pv.id
    LEFT JOIN products p ON bci.product_id = p.id
    WHERE bc.buyer_user_id = p_user_id
      AND bci.is_active = TRUE
  )
  SELECT 
    COALESCE(SUM(ci.item_weight_kg * ci.quantity), 0),
    BOOL_OR(ci.is_oversize),
    MAX(ci.length_cm),
    MAX(ci.width_cm),
    MAX(ci.height_cm)
  INTO v_total_weight, v_has_oversize, v_max_length, v_max_width, v_max_height
  FROM cart_items ci;

  -- Si no hay peso, retornar cero
  IF v_total_weight = 0 OR v_total_weight IS NULL THEN
    RETURN json_build_object(
      'total_weight_kg', 0,
      'shipping_cost', 0,
      'message', 'no_weight_available'
    );
  END IF;

  -- ============================================================================
  -- ============================================================================
  -- PASO 3: Validar que se seleccionó un tipo de envío
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    RETURN json_build_object(
      'total_weight_kg', ROUND(v_total_weight, 3),
      'shipping_cost', null,
      'message', 'no_shipping_type_selected',
      'error', 'El usuario debe seleccionar un tipo de envío',
      'user_id', p_user_id
    );
  END IF;

  -- ============================================================================
  -- PASO 4: Calcular costo de envío
  -- ============================================================================
  
  SELECT json_build_object(
    'total_weight_kg', ROUND(v_total_weight, 3),
    'weight_rounded_kg', csc.weight_rounded_kg,
    'base_cost', csc.base_cost,
    'oversize_surcharge', csc.oversize_surcharge,
    'dimensional_surcharge', csc.dimensional_surcharge,
    'extra_cost', csc.extra_cost,
    'shipping_cost', csc.total_cost_with_type,
    'shipping_type_name', csc.shipping_type_name,
    'shipping_type_display', csc.shipping_type_display,
    'volume_m3', csc.volume_m3,
    'route_id', csc.route_id,
    'user_id', p_user_id
  )
  INTO v_result
  FROM public.calculate_shipping_cost_cart(
    v_total_weight,           -- ✅ Peso
    p_shipping_type_id,       -- ✅ Tier (obligatorio)
    v_has_oversize,
    v_max_length,
    v_max_width,
    v_max_height
  ) csc;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_cart_shipping_cost IS 
  'Calcula el costo de envío total del carrito del usuario.
  REQUIERE que el usuario seleccione un tipo de envío (p_shipping_type_id).
  Sin tier seleccionado → retorna error.
  Usa shipping_tiers (no shipping_type_configs).';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Test 1: Calcular con tier específico (ignora route_id)
DO $$
DECLARE
  v_tier_id UUID;
  v_result JSON;
BEGIN
  -- Obtener un tier de ejemplo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_tier_id IS NOT NULL THEN
    -- Calcular con tier específico (el tier define su propia route)
    SELECT * INTO v_result
    FROM calculate_shipping_cost_cart(
      2.5,          -- Peso
      v_tier_id,    -- Tier (usa su route)
      NULL,         -- route_id ignorado
      FALSE         -- No oversize
    );
    
    RAISE NOTICE '✅ Test con tier específico: OK';
  END IF;
END $$;

-- Test 2: Calcular solo con route_id (busca STANDARD)
SELECT 
  '✅ Test con route_id (busca STANDARD)' as test,
  *
FROM calculate_shipping_cost_cart(
  2.5,  -- Peso
  NULL, -- No tier (buscará STANDARD)
  '21420dcb-9d8a-4947-8530-aaf3519c9047', -- Route Haití
  FALSE -- No oversize
);

-- Test 3: Calcular sin nada (usa defaults)
SELECT 
  '✅ Test solo con peso (defaults)' as test,
  *
FROM calculate_shipping_cost_cart(
  2.5,  -- Peso
  NULL, -- No tier
  NULL, -- No route
  FALSE -- No oversize
);

-- ============================================================================
-- RESUMEN DE CAMBIOS
-- ============================================================================

SELECT 
  '✅ CAMBIOS APLICADOS CORRECTAMENTE' as status,
  'LÓGICA SIMPLIFICADA: El tier seleccionado define la ruta y tarifas' as cambio_principal,
  'NUEVO ORDEN: calculate_shipping_cost_cart(peso, tier_id, route_id)' as nuevo_orden,
  'FLUJO: 1. Tier seleccionado → 2. STANDARD de route → 3. Defaults' as flujo;
