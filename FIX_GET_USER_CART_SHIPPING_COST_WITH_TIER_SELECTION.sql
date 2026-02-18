-- ============================================================================
-- ACTUALIZAR get_user_cart_shipping_cost PARA RECIBIR TIPO DE ENVÍO SELECCIONADO
-- ============================================================================
-- 
-- PROBLEMA ACTUAL:
-- La función get_user_cart_shipping_cost no recibe el tipo de envío que el 
-- usuario seleccionó, entonces siempre calcula con STANDARD (hardcodeado).
--
-- SOLUCIÓN:
-- ✅ Agregar parámetro p_shipping_type_id (el tier que el usuario seleccionó)
-- ✅ Consultar items desde b2b_cart_items (SEGURO - no manipulable desde frontend)
-- ✅ Pasar el shipping_type_id a calculate_cart_shipping_cost_dynamic
-- ✅ Frontend solo pasa: user_id + shipping_type_id (ningún dato de items)
--
-- SEGURIDAD GARANTIZADA:
-- - Items: consultados desde DB ✅
-- - Pesos: consultados desde DB ✅ 
-- - Cantidades: consultadas desde DB ✅
-- - Frontend solo pasa IDs (no puede manipular datos) ✅
-- ============================================================================

-- Primero, drop de las versiones antiguas
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID, UUID) CASCADE;

-- ============================================================================
-- FUNCIÓN ACTUALIZADA: Con parámetro de tipo de envío
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_cart_shipping_cost(
  p_user_id UUID,
  p_shipping_type_id UUID DEFAULT NULL  -- ✅ NUEVO: Recibe el tier seleccionado
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
  -- PASO 1: Consultar items DESDE LA DB (SEGURO - no manipulable)
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
    AND c.status = 'open'  -- Solo carrito activo
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
  -- PASO 2: Obtener ruta (China → Haití por defecto)
  -- ============================================================================
  
  SELECT sr.id INTO v_route_id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1;
  
  -- Fallback a ruta por defecto
  v_route_id := COALESCE(v_route_id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid);
  
  -- ============================================================================
  -- PASO 3: Si NO se proporcionó tier, usar el STANDARD de la ruta
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    -- Buscar tier STANDARD (marítimo) de esta ruta
    SELECT id INTO p_shipping_type_id
    FROM public.shipping_tiers
    WHERE route_id = v_route_id
      AND transport_type = 'maritimo'
      AND is_active = TRUE
    ORDER BY priority_order ASC
    LIMIT 1;
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
  -- PASO 5: Llamar a calculate_shipping_cost_cart con el tier SELECCIONADO
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
    'user_id', p_user_id
  )
  INTO v_result
  FROM public.calculate_shipping_cost_cart(
    v_route_id,
    v_total_weight,
    p_shipping_type_id,  -- ✅ USA EL TIER SELECCIONADO (o STANDARD si es NULL)
    v_has_oversize,
    v_max_length,
    v_max_width,
    v_max_height
  ) csc;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_user_cart_shipping_cost IS 
  '✅ ACTUALIZADO 2026-02-18: Calcula costo de envío consultando items desde b2b_cart_items (SEGURO).
  Recibe user_id + shipping_type_id (tier seleccionado por el usuario).
  Frontend NO puede manipular items, pesos o cantidades - todo viene de la DB.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 
  '✅ Función get_user_cart_shipping_cost actualizada' as resultado,
  'Ahora recibe shipping_type_id del tier seleccionado' as cambio,
  'Items consultados desde DB - seguro contra manipulación' as seguridad;
