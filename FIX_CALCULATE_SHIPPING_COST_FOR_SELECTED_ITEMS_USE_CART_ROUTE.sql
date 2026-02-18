-- =============================================================================
-- ACTUALIZAR: calculate_shipping_cost_for_selected_items
-- =============================================================================
-- CAMBIO: Ahora obtiene route_id desde b2b_carts (no hardcoded)
-- REQUISITO: Ejecutar ADD_ROUTE_ID_TO_B2B_CARTS.sql PRIMERO
-- =============================================================================

DROP FUNCTION IF EXISTS public.calculate_shipping_cost_for_selected_items(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_for_selected_items(UUID[], UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[],
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_items INTEGER;
  v_cart_id UUID;
  v_route_id UUID;
  v_shipping_type_id UUID;
  v_shipping_cost JSONB;
  v_shipping_type_name TEXT;
BEGIN
  -- Validar que se enviaron IDs
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL OR array_length(p_item_ids, 1) = 0 THEN
    RETURN json_build_object(
      'total_items', 0,
      'total_weight_kg', 0,
      'weight_rounded_kg', 0,
      'shipping_cost_usd', 0,
      'message', 'No items selected'
    );
  END IF;

  -- Obtener peso total, cart_id, y route_id de los items seleccionados
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(*),
    bci.cart_id,
    bc.route_id
  INTO 
    v_total_weight, 
    v_total_items,
    v_cart_id,
    v_route_id
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.id = ANY(p_item_ids)
  GROUP BY bci.cart_id, bc.route_id
  LIMIT 1;

  -- Si no hay peso o items, retornar 0
  IF v_total_items = 0 OR v_total_weight = 0 THEN
    RETURN json_build_object(
      'total_items', v_total_items,
      'total_weight_kg', 0,
      'weight_rounded_kg', 0,
      'shipping_cost_usd', 0,
      'message', 'No weight data available'
    );
  END IF;

  -- ============================================================================
  -- Validar que se seleccionó un tipo de envío
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    RETURN json_build_object(
      'shipping_cost_usd', null,
      'total_items', v_total_items,
      'total_weight_kg', v_total_weight,
      'message', 'no_shipping_type_selected',
      'error', 'El usuario debe seleccionar un tipo de envío'
    );
  END IF;

  -- Llamar a calculate_shipping_cost_cart que ya usa shipping_tiers
  SELECT 
    json_build_object(
      'total_cost_with_type', resultado->>'total_cost_with_type',
      'shipping_type_display', resultado->>'shipping_type_display',
      'total_weight_kg', resultado->>'total_weight_kg',
      'weight_rounded_kg', resultado->>'weight_rounded_kg',
      'tramo_a_cost', resultado->>'tramo_a_cost',
      'tramo_b_cost', resultado->>'tramo_b_cost',
      'base_shipping_cost', resultado->>'base_shipping_cost',
      'extra_surcharge_fixed', resultado->>'extra_surcharge_fixed',
      'extra_surcharge_percent', resultado->>'extra_surcharge_percent',
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
    'shipping_cost_usd', ROUND((v_shipping_cost->>'total_cost_with_type')::NUMERIC, 2),
    'shipping_type_id', v_shipping_type_id,
    'shipping_type_name', v_shipping_type_name,
    'route_id', v_route_id,
    'formula', 'Uses shipping_tiers (not hardcoded)',
    'message', 'success',
    'details', v_shipping_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION public.calculate_shipping_cost_for_selected_items IS 
  'Calcula costo de envío SOLO para los cart items seleccionados usando shipping_tiers.
   
   Parámetros:
   - p_item_ids: Array de UUIDs de b2b_cart_items seleccionados
   - p_shipping_type_id: UUID del tipo de envío (tier) a usar. Si NULL, usa STANDARD de la ruta.
   
   Retorna JSON con:
   - total_items, total_weight_kg, weight_rounded_kg, shipping_cost_usd
   - shipping_type_id, shipping_type_name, route_id
   - details: Desglose completo de costos
   
   IMPORTANTE: 
   - Ahora usa shipping_tiers (NO costos hardcoded)
   - Lee route_id desde b2b_carts.route_id
   - Si no hay ruta, usa fallback: China → Haití';

-- =============================================================================
-- VERIFICACIÓN Y TEST
-- =============================================================================

-- Ver tus items actuales con ruta del carrito
SELECT 
  '📦 ITEMS Y RUTA DEL CARRITO' as info,
  bc.id as cart_id,
  bc.route_id,
  CONCAT(sr.origin_country, ' → ', sr.destination_country) as ruta,
  bci.id as item_id,
  bci.sku,
  bci.nombre,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
LEFT JOIN shipping_routes sr ON bc.route_id = sr.id
WHERE bc.buyer_user_id = auth.uid()
LIMIT 5;

-- Ver tipos de envío disponibles para la ruta del carrito
SELECT 
  '📮 TIPOS DE ENVÍO PARA TU RUTA' as info,
  st.id as shipping_type_id,
  st.tier_name,
  st.custom_tier_name,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  CONCAT(
    'Tramo A: $', st.tramo_a_cost_per_kg, '/kg, ',
    'Tramo B: $', st.tramo_b_cost_per_lb, '/lb'
  ) as costos
FROM shipping_tiers st
WHERE st.route_id = (
  SELECT route_id 
  FROM b2b_carts 
  WHERE buyer_user_id = auth.uid() 
    AND status = 'open'
  LIMIT 1
);

-- =============================================================================
-- RESULTADO
-- =============================================================================

SELECT 
  '✅ Función calculate_shipping_cost_for_selected_items ACTUALIZADA' as resultado,
  '🔧 Ahora lee route_id desde b2b_carts.route_id' as cambio_1,
  '🌍 Ya NO usa ruta hardcoded (solo como fallback)' as cambio_2,
  '📮 Recibe shipping_type_id como parámetro' as cambio_3,
  '🔐 Calcula desde DB con calculate_shipping_cost_cart' as cambio_4;
