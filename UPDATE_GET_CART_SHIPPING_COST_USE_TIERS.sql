-- ============================================================================
-- FIX: Actualizar get_cart_shipping_cost para usar shipping_tiers correctamente
-- ============================================================================
-- 
-- PROBLEMA: 
-- - get_cart_shipping_cost llama a calculate_cart_shipping_cost_dynamic
-- - Que llama a calculate_shipping_cost_cart con firma ANTIGUA (incluye route_id)
-- - Pero calculate_shipping_cost_cart YA NO recibe route_id, solo shipping_type_id
--
-- SOLUCIÓN:
-- Actualizar calculate_cart_shipping_cost_dynamic para usar la firma correcta
-- ============================================================================

-- Eliminar versiones anteriores
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_cart_shipping_cost_dynamic(
  p_cart_items JSONB,  -- Array de items: [{"product_id": "uuid", "variant_id": "uuid", "quantity": 2}]
  p_shipping_type_id UUID DEFAULT NULL  -- Tier seleccionado (opcional, usa STANDARD si es NULL)
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
  v_shipping_type_id UUID;
  v_total_weight NUMERIC := 0;
  v_has_oversize BOOLEAN := FALSE;
  v_max_length NUMERIC := 0;
  v_max_width NUMERIC := 0;
  v_max_height NUMERIC := 0;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_weight NUMERIC;
  v_is_oversize BOOLEAN;
  v_length NUMERIC;
  v_width NUMERIC;
  v_height NUMERIC;
BEGIN
  -- ============================================================================
  -- 1. Determinar qué shipping tier usar
  -- ============================================================================
  
  IF p_shipping_type_id IS NULL THEN
    -- Si no se proporcionó tipo, buscar STANDARD (marítimo) activo
    SELECT id INTO v_shipping_type_id
    FROM public.shipping_tiers
    WHERE transport_type = 'maritimo'
      AND tier_name = 'STANDARD'
      AND is_active = TRUE
    ORDER BY priority_order ASC
    LIMIT 1;
    
    -- Si no existe STANDARD, tomar el primer tier activo
    IF v_shipping_type_id IS NULL THEN
      SELECT id INTO v_shipping_type_id
      FROM public.shipping_tiers
      WHERE is_active = TRUE
      ORDER BY priority_order ASC
      LIMIT 1;
    END IF;
  ELSE
    -- Usar el tier que el usuario seleccionó
    v_shipping_type_id := p_shipping_type_id;
  END IF;
  
  -- Si aún no hay tier, error
  IF v_shipping_type_id IS NULL THEN
    RAISE EXCEPTION 'No hay tiers de envío activos configurados';
  END IF;
  
  -- ============================================================================
  -- 2. Iterar sobre items del carrito y calcular peso total
  -- ============================================================================
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := CASE 
      WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != 'null' 
      THEN (v_item->>'variant_id')::UUID 
      ELSE NULL 
    END;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    
    -- Obtener peso del producto o variante
    IF v_variant_id IS NOT NULL THEN
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
      WHERE pv.id = v_variant_id;
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
      WHERE p.id = v_product_id;
    END IF;
    
    -- Acumular peso total
    v_total_weight := v_total_weight + (COALESCE(v_weight, 0) * v_quantity);
    
    -- Verificar si hay algún item oversize
    IF v_is_oversize THEN
      v_has_oversize := TRUE;
    END IF;
    
    -- Actualizar dimensiones máximas
    IF v_length > v_max_length THEN
      v_max_length := v_length;
    END IF;
    IF v_width > v_max_width THEN
      v_max_width := v_width;
    END IF;
    IF v_height > v_max_height THEN
      v_max_height := v_height;
    END IF;
  END LOOP;
  
  -- ============================================================================
  -- 3. Llamar a calculate_shipping_cost_cart (USA SHIPPING_TIERS)
  -- ============================================================================
  
  -- ✅ FIRMA CORRECTA (sin route_id):
  -- calculate_shipping_cost_cart(peso, tier_id, is_oversize, length, width, height)
  
  RETURN QUERY
  SELECT 
    jsonb_array_length(p_cart_items) as total_items,
    v_total_weight as total_weight_kg,
    csc.weight_rounded_kg,
    csc.base_cost,
    csc.oversize_surcharge,
    csc.dimensional_surcharge,
    csc.extra_cost,
    csc.total_cost_with_type,
    csc.shipping_type_name,
    csc.shipping_type_display,
    csc.volume_m3,
    csc.route_id
  FROM public.calculate_shipping_cost_cart(
    v_total_weight,      -- p_total_weight_kg
    v_shipping_type_id,  -- p_shipping_type_id (OBLIGATORIO)
    v_has_oversize,      -- p_is_oversize
    v_max_length,        -- p_length_cm
    v_max_width,         -- p_width_cm
    v_max_height         -- p_height_cm
  ) csc;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_cart_shipping_cost_dynamic IS 
  '✅ Calcula costo de envío EN TIEMPO REAL para preview usando shipping_tiers.
  
  USO VÁLIDO:
  - Preview mientras usuario edita cantidades en el carrito
  - Mostrar costo estimado antes de guardar cambios
  
  PARÁMETROS:
  - p_cart_items: Array JSONB de items [{"product_id": "uuid", "variant_id": "uuid", "quantity": 2}]
  - p_shipping_type_id: UUID del tier seleccionado (NULL = usa STANDARD)
  
  SEGURIDAD:
  ⚠️ Items vienen del frontend - usar solo para PREVIEW
  ✅ Backend/Checkout: SIEMPRE recalcular desde DB con calculate_shipping_cost_for_selected_items';

-- ============================================================================
-- Actualizar wrapper get_cart_shipping_cost
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_cart_shipping_cost(
  cart_items JSONB,
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result
  FROM public.calculate_cart_shipping_cost_dynamic(cart_items, p_shipping_type_id);
  
  RETURN jsonb_build_object(
    'total_items', v_result.total_items,
    'total_weight_kg', v_result.total_weight_kg,
    'weight_rounded_kg', v_result.weight_rounded_kg,
    'base_cost', v_result.base_cost,
    'oversize_surcharge', v_result.oversize_surcharge,
    'dimensional_surcharge', v_result.dimensional_surcharge,
    'extra_cost', v_result.extra_cost,
    'total_cost_with_type', v_result.total_cost_with_type,
    'shipping_type_name', v_result.shipping_type_name,
    'shipping_type_display', v_result.shipping_type_display,
    'volume_m3', v_result.volume_m3,
    'route_id', v_result.route_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_cart_shipping_cost IS 
  'Wrapper RPC para calcular costo de envío en tiempo real (preview). 
  Recibe cart_items + shipping_type_id seleccionado.
  Usa shipping_tiers (nuevo sistema).
  ⚠️ Solo para preview - Backend debe recalcular desde DB antes de checkout.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT '✅ FUNCIONES ACTUALIZADAS PARA USAR SHIPPING_TIERS' as status;

-- Test rápido
DO $$
DECLARE
  v_test_items JSONB;
  v_tier_id UUID;
  v_result JSONB;
BEGIN
  -- Obtener un tier activo
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_tier_id IS NULL THEN
    RAISE NOTICE '⚠️ No hay tiers activos para probar';
    RETURN;
  END IF;
  
  -- Crear items de prueba (simulando frontend)
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', p.id,
      'variant_id', null,
      'quantity', 2
    )
  ) INTO v_test_items
  FROM products p
  WHERE p.peso_kg IS NOT NULL AND p.peso_kg > 0
  LIMIT 3;
  
  IF v_test_items IS NULL OR jsonb_array_length(v_test_items) = 0 THEN
    RAISE NOTICE '⚠️ No hay productos con peso para probar';
    RETURN;
  END IF;
  
  -- Llamar a la función
  SELECT get_cart_shipping_cost(v_test_items, v_tier_id) INTO v_result;
  
  RAISE NOTICE '✅ Test exitoso:';
  RAISE NOTICE '  • Items: %', v_result->>'total_items';
  RAISE NOTICE '  • Peso: % kg', v_result->>'total_weight_kg';
  RAISE NOTICE '  • Costo base: $%', v_result->>'base_cost';
  RAISE NOTICE '  • Costo total: $%', v_result->>'total_cost_with_type';
  RAISE NOTICE '  • Tier: %', v_result->>'shipping_type_name';
END $$;
