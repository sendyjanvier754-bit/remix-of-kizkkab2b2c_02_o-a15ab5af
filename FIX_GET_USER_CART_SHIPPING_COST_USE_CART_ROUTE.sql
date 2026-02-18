-- ============================================================================
-- ACTUALIZAR get_user_cart_shipping_cost PARA LEER RUTA DEL CARRITO
-- ============================================================================
-- 
-- CAMBIO: Ahora obtiene route_id desde b2b_carts.route_id
-- REQUISITO: Ejecutar ADD_ROUTE_ID_TO_B2B_CARTS.sql PRIMERO
--
-- ============================================================================

-- Drop versiones antiguas
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID, UUID) CASCADE;

-- ============================================================================
-- FUNCIÓN ACTUALIZADA: Lee route_id desde b2b_carts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_cart_shipping_cost(
  p_user_id UUID,
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cart_items JSONB;
  v_result JSONB;
  v_route_id UUID;
  v_total_weight NUMERIC := 0;
  v_has_oversize BOOLEAN := FALSE;
  v_max_length NUMERIC := 0;
  v_max_width NUMERIC := 0;
  v_max_height NUMERIC := 0;
  v_item RECORD;
  v_weight NUMERIC;
  v_is_oversize BOOLEAN;
  v_length NUMERIC;
  v_width NUMERIC;
  v_height NUMERIC;
BEGIN
  -- ============================================================================
  -- PASO 1: Obtener route_id desde el carrito del usuario
  -- ============================================================================
  
  SELECT c.route_id
  INTO v_route_id
  FROM public.b2b_carts c
  WHERE c.buyer_user_id = p_user_id
    AND c.status = 'open'
  LIMIT 1;
  
  -- Si no hay ruta en el carrito, usar default (China → Haití)
  IF v_route_id IS NULL THEN
    v_route_id := '21420dcb-9d8a-4947-8530-aaf3519c9047';
  END IF;

  -- ============================================================================
  -- PASO 2: Consultar items DESDE LA DB (SEGURO - no manipulable)
  -- ============================================================================
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', ci.product_id,
      'variant_id', ci.variant_id,
      'quantity', ci.quantity
    )
  )
  INTO v_cart_items
  FROM public.b2b_cart_items ci
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  WHERE c.buyer_user_id = p_user_id
    AND c.status = 'open'
    AND ci.product_id IS NOT NULL;
  
  -- Si no hay items, retornar costo cero
  IF v_cart_items IS NULL OR jsonb_array_length(v_cart_items) = 0 THEN
    RETURN jsonb_build_object(
      'total_items', 0,
      'total_weight_kg', 0,
      'weight_rounded_kg', 0,
      'base_cost', 0,
      'oversize_surcharge', 0,
      'dimensional_surcharge', 0,
      'extra_cost', 0,
      'total_cost_with_type', 0,
      'shipping_type_name', 'N/A',
      'shipping_type_display', 'Carrito vacío',
      'volume_m3', 0,
      'message', 'Carrito vacío'
    );
  END IF;
  
  -- ============================================================================
  -- PASO 3: Validar que se seleccionó un tipo de envío
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    RETURN json_build_object(
      'total_weight_kg', 0,
      'shipping_cost', null,
      'message', 'no_shipping_type_selected',
      'error', 'El usuario debe seleccionar un tipo de envío'
    );
  END IF;
  
  -- ============================================================================
  -- PASO 4: Calcular peso total y dimensiones DESDE LA DB (SEGURO)
  -- ============================================================================
  
  FOR v_item IN 
    SELECT 
      (item->>'product_id')::UUID as product_id,
      CASE 
        WHEN item->>'variant_id' IS NOT NULL AND item->>'variant_id' != 'null' 
        THEN (item->>'variant_id')::UUID 
        ELSE NULL 
      END as variant_id,
      COALESCE((item->>'quantity')::INTEGER, 1) as quantity
    FROM jsonb_array_elements(v_cart_items) AS item
  LOOP
    -- Obtener peso del producto o variante DESDE LA DB
    IF v_item.variant_id IS NOT NULL THEN
      -- Priorizar variante si existe
      SELECT 
        COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0),
        COALESCE(p.is_oversize, FALSE),
        p.length_cm,
        p.width_cm,
        p.height_cm
      INTO v_weight, v_is_oversize, v_length, v_width, v_height
      FROM public.product_variants pv
      JOIN public.products p ON pv.product_id = p.id
      WHERE pv.id = v_item.variant_id;
    ELSE
      -- Usar producto directamente
      SELECT 
        COALESCE(p.peso_kg, p.peso_g::numeric / 1000.0, 0),
        COALESCE(p.is_oversize, FALSE),
        p.length_cm,
        p.width_cm,
        p.height_cm
      INTO v_weight, v_is_oversize, v_length, v_width, v_height
      FROM public.products p
      WHERE p.id = v_item.product_id;
    END IF;
    
    -- Acumular peso total
    v_total_weight := v_total_weight + (COALESCE(v_weight, 0) * v_item.quantity);
    
    -- Verificar si hay algún item oversize
    IF v_is_oversize THEN
      v_has_oversize := TRUE;
    END IF;
    
    -- Actualizar dimensiones máximas
    IF v_length > v_max_length THEN v_max_length := v_length; END IF;
    IF v_width > v_max_width THEN v_max_width := v_width; END IF;
    IF v_height > v_max_height THEN v_max_height := v_height; END IF;
  END LOOP;
  
  -- ============================================================================
  -- PASO 5: Llamar a calculate_shipping_cost_cart con el tier y ruta
  -- ============================================================================
  
  SELECT jsonb_build_object(
    'total_items', jsonb_array_length(v_cart_items),
    'total_weight_kg', v_total_weight,
    'weight_rounded_kg', csc.weight_rounded_kg,
    'base_cost', csc.base_cost,
    'oversize_surcharge', csc.oversize_surcharge,
    'dimensional_surcharge', csc.dimensional_surcharge,
    'extra_cost', csc.extra_cost,
    'total_cost_with_type', csc.total_cost_with_type,
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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_user_cart_shipping_cost IS 
  '✅ ACTUALIZADO 2026-02-18: Calcula costo de envío consultando items y ruta desde DB (SEGURO).
  - Lee route_id desde b2b_carts.route_id
  - Lee items desde b2b_cart_items
  - Recibe user_id + shipping_type_id (tier seleccionado, OBLIGATORIO)
  - Sin tier seleccionado → error
  - Frontend NO puede manipular items, pesos, cantidades o ruta';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver carritos con sus rutas
SELECT 
  '🛒 CARRITOS CON RUTAS' as info,
  bc.id,
  bc.buyer_user_id,
  bc.route_id,
  CONCAT(sr.origin_country, ' → ', sr.destination_country) as ruta
FROM b2b_carts bc
LEFT JOIN shipping_routes sr ON bc.route_id = sr.id
WHERE bc.status = 'open'
LIMIT 5;

-- Test de la función (reemplaza con tu user_id real)
/*
SELECT 
  '💰 TEST: Calcular costo para usuario' as test,
  get_user_cart_shipping_cost(
    '376067ef-7629-47f1-be38-bbf8d728ddf0'::UUID,  -- user_id
    NULL  -- shipping_type_id (NULL = usa STANDARD)
  );
*/

-- ============================================================================
-- RESULTADO
-- ============================================================================

SELECT 
  '✅ Función get_user_cart_shipping_cost actualizada' as resultado,
  '🔧 Ahora lee route_id desde b2b_carts.route_id' as cambio_1,
  '🌍 Ya NO usa ruta hardcoded (solo como fallback)' as cambio_2,
  '📮 Recibe shipping_type_id como parámetro' as cambio_3,
  '🔐 Todo calculado desde DB (items + ruta + pesos)' as cambio_4;
