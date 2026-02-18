-- ============================================================================
-- ACTUALIZAR FUNCIÓN calculate_cart_shipping_cost_dynamic PARA USAR SHIPPING_TIERS
-- ============================================================================
-- 
-- ✅ USO VÁLIDO: Calcular costo EN TIEMPO REAL mientras usuario edita carrito
-- 
-- CASO DE USO:
-- - Usuario cambia cantidad de 2 a 5 unidades (no guardado aún)
-- - Necesita ver costo actualizado INMEDIATAMENTE
-- - Esta función calcula con las cantidades temporales del UI
--
-- SEGURIDAD:
-- ⚠️ Items vienen del frontend - OK para PREVIEW, NO para checkout
-- ✅ Backend SIEMPRE debe recalcular con get_user_cart_shipping_cost antes de procesar orden
--
-- CAMBIOS EN ESTA ACTUALIZACIÓN:
-- ✅ Agregado p_shipping_type_id como parámetro
-- ✅ Ya no hardcodea 'maritimo' (STANDARD)
-- ✅ Usa el tier que el usuario seleccionó
-- ✅ Usa shipping_tiers en lugar de shipping_type_configs
-- ============================================================================

-- Eliminar versiones anteriores con diferentes firmas
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_cart_shipping_cost_dynamic(
  p_cart_items JSONB,  -- Array de items: [{"product_id": "uuid", "variant_id": "uuid", "quantity": 2}]
  p_shipping_type_id UUID DEFAULT NULL  -- ✅ NUEVO: Tier seleccionado
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
  volume_m3 NUMERIC
) AS $$
DECLARE
  v_route_id UUID;
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
  -- 1. Obtener ruta por defecto (CHINA → HT)
  SELECT sr.id INTO v_route_id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1;
  
  -- Si no existe ruta, usar ID por defecto
  v_route_id := COALESCE(v_route_id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid);
  
  -- ✅ CAMBIO: Usar el shipping_type_id recibido o buscar STANDARD si es NULL
  IF p_shipping_type_id IS NULL THEN
    -- Si no se proporcionó tipo, buscar STANDARD (marítimo) de esta ruta
    SELECT id INTO v_shipping_type_id
    FROM public.shipping_tiers
    WHERE route_id = v_route_id
      AND transport_type = 'maritimo'  -- STANDARD = marítimo
      AND is_active = TRUE
    ORDER BY priority_order ASC
    LIMIT 1;
  ELSE
    -- Usar el tipo de envío que el usuario seleccionó
    v_shipping_type_id := p_shipping_type_id;
  END IF;
  
  -- 3. Iterar sobre cada item del carrito y calcular peso total
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
    -- USA LA MISMA FUENTE DE DATOS QUE v_product_shipping_costs: peso_kg, peso_g
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
  
  -- 4. Llamar a calculate_shipping_cost_cart con el peso total calculado
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
    csc.volume_m3
  FROM public.calculate_shipping_cost_cart(
    v_route_id,
    v_total_weight,
    v_shipping_type_id,
    v_has_oversize,
    v_max_length,
    v_max_width,
    v_max_height
  ) csc;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_cart_shipping_cost_dynamic IS 
  '✅ ACTUALIZADO 2026-02-18: Calcula costo de envío EN TIEMPO REAL para preview.
  Usa shipping_tiers con el tier seleccionado por el usuario.
  
  USO VÁLIDO:
  - Preview mientras usuario edita cantidades en el carrito
  - Mostrar costo estimado antes de guardar cambios
  
  SEGURIDAD:
  ⚠️ Items vienen del frontend - usar solo para PREVIEW
  ✅ Backend/Checkout: SIEMPRE recalcular con get_user_cart_shipping_cost(user_id, tier_id)';

-- ============================================================================
-- ACTUALIZAR FUNCIÓN get_cart_shipping_cost (wrapper para frontend)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_cart_shipping_cost(
  cart_items JSONB,
  p_shipping_type_id UUID DEFAULT NULL  -- ✅ Tier seleccionado
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
    'volume_m3', v_result.volume_m3
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_cart_shipping_cost IS 
  'Wrapper RPC para calcular costo de envío en tiempo real (preview). 
  Recibe cart_items + shipping_type_id seleccionado.
  ⚠️ Solo para preview - Backend debe recalcular desde DB antes de checkout.';

-- ============================================================================
-- VERIFICAR ACTUALIZACIÓN
-- ============================================================================
SELECT 
  '✅ Funciones actualizadas' as resultado,
  'calculate_cart_shipping_cost_dynamic + get_cart_shipping_cost' as funciones,
  'Ahora usan shipping_tiers y reciben tier seleccionado' as cambio;

-- ============================================================================
-- GUÍA DE USO: Cuándo usar cada función
-- ============================================================================
/*
┌────────────────────────────────────────────────────────────────────────┐
│ CASO DE USO                           │ FUNCIÓN A USAR                  │
├────────────────────────────────────────────────────────────────────────┤
│ 🔄 Preview en tiempo real              │ get_cart_shipping_cost()       │
│    (usuario cambia cantidades)        │   + cart_items del estado      │
│                                       │   + shipping_type_id           │
│                                       │                                │
│ 💰 Costo final (checkout/orden)       │ get_user_cart_shipping_cost()  │
│                                       │   + user_id (auth.uid())       │
│                                       │   + shipping_type_id           │
│                                       │                                │
│ 📊 Backend/Jobs/Admin                 │ get_user_cart_shipping_cost()  │
│                                       │   + user_id                    │
│                                       │   + shipping_type_id           │
└────────────────────────────────────────────────────────────────────────┘

FRONTEND REACT EJEMPLO:
========================

function CartPage() {
  const [cartItems, setCartItems] = useState([...]);
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [previewCost, setPreviewCost] = useState(0);

  // Calcular preview EN TIEMPO REAL cuando cambia cantidad o tier
  useEffect(() => {
    async function calculatePreview() {
      // ✅ Preview con cantidades temporales (no guardadas)
      const { data } = await supabase.rpc('get_cart_shipping_cost', {
        cart_items: cartItems.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity  // Cantidad temporal del UI
        })),
        p_shipping_type_id: selectedTierId
      });
      
      setPreviewCost(data?.total_cost_with_type || 0);
    }
    
    calculatePreview();
  }, [cartItems, selectedTierId]);  // Recalcula cuando cambian

  async function handleCheckout() {
    const { data: user } = await supabase.auth.getUser();
    
    // ✅ Costo FINAL desde DB (seguro, no manipulable)
    const { data: finalCost } = await supabase.rpc('get_user_cart_shipping_cost', {
      p_user_id: user.id,
      p_shipping_type_id: selectedTierId
    });
    
    // Usar finalCost.total_cost_with_type para la orden
    await createOrder(finalCost.total_cost_with_type);
  }

  return (
    <div>
      <h2>Preview: ${previewCost.toFixed(2)}</h2>
      <button onClick={handleCheckout}>Checkout</button>
    </div>
  );
}

VALIDACIÓN BACKEND:
===================

-- Antes de crear orden, SIEMPRE recalcular desde DB:
CREATE OR REPLACE FUNCTION create_order_with_validated_cost(
  p_user_id UUID,
  p_shipping_type_id UUID,
  p_cart_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_validated_cost JSONB;
BEGIN
  -- ✅ Recalcular costo desde DB (no confiar en el frontend)
  SELECT get_user_cart_shipping_cost(p_user_id, p_shipping_type_id)
  INTO v_validated_cost;
  
  -- Crear orden con el costo validado
  INSERT INTO orders (user_id, shipping_cost, ...)
  VALUES (p_user_id, (v_validated_cost->>'total_cost_with_type')::numeric, ...);
  
  RETURN v_validated_cost;
END;
$$ LANGUAGE plpgsql;
*/
