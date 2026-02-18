-- =============================================================================
-- ACTUALIZAR: calculate_shipping_cost_for_selected_items
-- =============================================================================
-- PROBLEMA: Función referenciaba bc.shipping_route_id que NO EXISTE en b2b_carts
-- SOLUCIÓN: Eliminar referencia a ruta del carrito y usar ruta por defecto
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

  -- Obtener peso total y cart_id de los items seleccionados
  -- NOTA: No obtenemos route_id del carrito porque esa columna NO existe
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(*),
    bci.cart_id
  INTO 
    v_total_weight, 
    v_total_items,
    v_cart_id
  FROM b2b_cart_items bci
  WHERE bci.id = ANY(p_item_ids)
  GROUP BY bci.cart_id
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

  -- Usar ruta por defecto (China → Haití)
  -- TODO: En el futuro, obtener esto desde user settings o market
  v_route_id := '21420dcb-9d8a-4947-8530-aaf3519c9047';

  -- Determinar shipping_type_id
  v_shipping_type_id := p_shipping_type_id;
  
  -- Si no se proporciona, buscar el tipo STANDARD de esta ruta
  IF v_shipping_type_id IS NULL THEN
    SELECT id 
    INTO v_shipping_type_id
    FROM public.shipping_tiers
    WHERE route_id = v_route_id
      AND LOWER(tier_name) = 'standard'
    LIMIT 1;
  END IF;

  -- Si aún no hay tier, usar el primero de la ruta
  IF v_shipping_type_id IS NULL THEN
    SELECT id 
    INTO v_shipping_type_id
    FROM public.shipping_tiers
    WHERE route_id = v_route_id
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Obtener nombre del tipo de envío
  SELECT tier_name 
  INTO v_shipping_type_name
  FROM public.shipping_tiers
  WHERE id = v_shipping_type_id;

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
    v_route_id,
    v_total_weight,
    v_shipping_type_id,
    FALSE, -- oversize
    NULL   -- dimensions
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
   - Usa ruta por defecto (China → Haití) ya que b2b_carts no tiene columna de ruta
   - En futuro, obtener ruta desde user settings o market';

-- =============================================================================
-- VERIFICACIÓN Y TEST
-- =============================================================================

-- Ver tus items actuales
SELECT 
  '📦 ITEMS EN TU CARRITO' as info,
  bci.id,
  bci.sku,
  bci.nombre,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid()
LIMIT 5;

-- Ver tipos de envío disponibles
SELECT 
  '📮 TIPOS DE ENVÍO DISPONIBLES' as info,
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
WHERE st.route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'; -- China → Haití

-- =============================================================================
-- RESULTADO
-- =============================================================================

SELECT 
  '✅ Función calculate_shipping_cost_for_selected_items CORREGIDA' as resultado,
  '🔧 Eliminada referencia a bc.shipping_route_id (no existe)' as cambio_1,
  '🌍 Usa ruta por defecto: China → Haití' as cambio_2,
  '📮 Recibe shipping_type_id como parámetro' as cambio_3,
  '🔐 Calcula desde DB con calculate_shipping_cost_cart' as cambio_4;
