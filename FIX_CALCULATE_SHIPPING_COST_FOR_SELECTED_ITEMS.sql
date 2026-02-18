-- =============================================================================
-- ACTUALIZAR: calculate_shipping_cost_for_selected_items
-- =============================================================================
-- PROBLEMA: Función tenía costos HARDCODED ($11.05 + $5.82/kg)
-- SOLUCIÓN: Ahora usa shipping_tiers y recibe shipping_type_id
-- =============================================================================

-- ⚠️ ANTES (HARDCODED):
-- IF v_weight_rounded <= 1 THEN
--   v_shipping_cost := 11.05;  -- ❌ HARDCODED
-- ELSE
--   v_shipping_cost := 11.05 + ((v_weight_rounded - 1) * 5.82);  -- ❌ HARDCODED
-- END IF;

-- ✅ AHORA: Usa shipping_tiers y recibe shipping_type_id

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
    bc.shipping_route_id
  INTO 
    v_total_weight, 
    v_total_items,
    v_cart_id,
    v_route_id
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.id = ANY(p_item_ids)
  GROUP BY bci.cart_id, bc.shipping_route_id
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

  -- Si no hay ruta, usar default (China → Haití)
  IF v_route_id IS NULL THEN
    v_route_id := '21420dcb-9d8a-4947-8530-aaf3519c9047';
  END IF;

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
   - shipping_type_id, shipping_type_name
   - details: Desglose completo de costos
   
   IMPORTANTE: Ahora usa shipping_tiers (NO costos hardcoded)';

-- =============================================================================
-- TEST
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
  AND bc.status = 'open'
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

-- Test: Calcular shipping para items seleccionados (reemplaza los IDs con los tuyos)
/*
SELECT 
  '💰 CÁLCULO DE SHIPPING (STANDARD)' as test,
  *
FROM calculate_shipping_cost_for_selected_items(
  ARRAY[
    'item-id-1'::UUID,
    'item-id-2'::UUID
  ]::UUID[],
  NULL  -- NULL = usa STANDARD
);

SELECT 
  '💰 CÁLCULO DE SHIPPING (EXPRESS)' as test,
  *
FROM calculate_shipping_cost_for_selected_items(
  ARRAY[
    'item-id-1'::UUID,
    'item-id-2'::UUID
  ]::UUID[],
  'express-tier-id'::UUID  -- Usa Express
);
*/

-- =============================================================================
-- RESULTADO
-- =============================================================================

SELECT 
  '✅ Función calculate_shipping_cost_for_selected_items ACTUALIZADA' as resultado,
  '🎯 Ahora usa shipping_tiers (NO hardcoded)' as cambio_1,
  '📮 Recibe shipping_type_id como parámetro' as cambio_2,
  '🔐 Calcula desde DB con calculate_shipping_cost_cart' as cambio_3;
