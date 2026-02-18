-- ============================================================================
-- FIX: Corregir nombre de columna en calculate_shipping_cost_for_selected_items
-- ============================================================================
-- 
-- PROBLEMA: La función usa bci.item_id pero la columna se llama bci.id
-- ERROR: column bci.item_id does not exist
-- 
-- SOLUCIÓN: Cambiar item_id por id en todos los lugares
-- ============================================================================

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
  -- ✅ FIX: Usar bci.id en vez de bci.item_id
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
  Un usuario solo puede calcular costos de sus propios items.
  
  FIX: Corregido para usar bci.id en vez de bci.item_id (columna correcta)';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT '✅ FUNCIÓN CORREGIDA - Ahora usa bci.id en vez de bci.item_id' as status;

-- Test rápido
DO $$
DECLARE
  v_item_ids UUID[];
  v_tier_id UUID;
  v_result JSON;
BEGIN
  -- Obtener primer item del carrito
  SELECT array_agg(bci.id)
  INTO v_item_ids
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.buyer_user_id = auth.uid()
  LIMIT 1;
  
  -- Obtener primer tier activo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_item_ids IS NOT NULL AND array_length(v_item_ids, 1) > 0 AND v_tier_id IS NOT NULL THEN
    SELECT calculate_shipping_cost_for_selected_items(
      v_item_ids,
      v_tier_id
    ) INTO v_result;
    
    RAISE NOTICE '✅ Test exitoso: %', v_result::text;
  ELSE
    RAISE NOTICE '⚠️ No hay items o tier para probar';
  END IF;
END $$;
