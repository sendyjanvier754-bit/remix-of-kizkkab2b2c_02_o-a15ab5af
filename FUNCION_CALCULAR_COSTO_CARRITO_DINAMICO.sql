-- =============================================================================
-- FUNCIÓN: calculate_cart_shipping_cost_dynamic
-- Fecha: 2026-02-12
-- Propósito: Calcular costo de logística para el carrito REAL del usuario
-- =============================================================================

/*
PROBLEMA:
=========
La vista v_cart_shipping_costs usa 10 productos fijos simulados.
Necesitamos calcular el costo para los productos REALES del carrito del usuario.

SOLUCIÓN (2 OPCIONES):
======================

OPCIÓN A: Frontend pasa items como parámetro (ESTE ARCHIVO) ✅
  - Función: get_cart_shipping_cost(cart_items JSONB)
  - Frontend construye array: [{product_id, variant_id, quantity}]
  - Ventaja: Flexible, no depende de estructura DB
  - Uso: Cuando ya tienes items en memoria/estado
  
OPCIÓN B: DB consulta carrito directamente (VER: FUNCION_CALCULAR_COSTO_CARRITO_USUARIO.sql) ✨
  - Función: get_user_cart_shipping_cost(user_id UUID)
  - DB consulta b2b_cart_items internamente
  - Ventaja: Más simple, solo necesitas user_id
  - Uso: Backend jobs, APIs, cuando solo tienes user_id

FLUJO COMÚN:
============
Ambas opciones llaman a:
1. calculate_cart_shipping_cost_dynamic() - Calcula peso total de items
2. calculate_shipping_cost_cart() - Calcula costo basado en peso
3. Retornan costo total en USD
*/

-- =============================================================================
-- PASO 1: Crear función para calcular costo de carrito dinámico
-- =============================================================================

DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_cart_shipping_cost_dynamic(
  p_cart_items JSONB  -- Array de items: [{"product_id": "uuid", "variant_id": "uuid", "quantity": 2}]
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
  
  -- 2. Obtener tipo de envío STANDARD
  SELECT id INTO v_shipping_type_id
  FROM public.shipping_type_configs
  WHERE type = 'STANDARD' AND is_active = TRUE
  LIMIT 1;
  
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
  'Calcula el costo de logística para el carrito REAL del usuario. Recibe array de items con product_id, variant_id opcional, y quantity. Retorna costo total en USD.';

-- =============================================================================
-- PASO 2: Crear función RPC para que el frontend pueda llamarla directamente
-- =============================================================================

-- Esta función es un wrapper para facilitar la llamada desde el frontend
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB) CASCADE;

CREATE OR REPLACE FUNCTION public.get_cart_shipping_cost(
  cart_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result
  FROM public.calculate_cart_shipping_cost_dynamic(cart_items);
  
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
  'RPC function para obtener costo de envío del carrito. Retorna JSONB con todos los campos de costos.';

-- =============================================================================
-- EJEMPLO DE USO
-- =============================================================================

/*
DESDE SQL:
----------

-- Ejemplo 1: Carrito con 2 productos simples
SELECT * FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "550e8400-e29b-41d4-a716-446655440001", "quantity": 2},
  {"product_id": "550e8400-e29b-41d4-a716-446655440002", "quantity": 1}
]'::jsonb);


-- Ejemplo 2: Carrito con producto y variante
SELECT * FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "550e8400-e29b-41d4-a716-446655440001", "quantity": 3},
  {"product_id": "550e8400-e29b-41d4-a716-446655440002", "variant_id": "660e8400-e29b-41d4-a716-446655440001", "quantity": 5}
]'::jsonb);


-- Ejemplo 3: Usando la función RPC (para frontend)
SELECT get_cart_shipping_cost('[
  {"product_id": "550e8400-e29b-41d4-a716-446655440001", "quantity": 2}
]'::jsonb);


DESDE FRONTEND (supabase.rpc):
-------------------------------

const { data, error } = await supabase.rpc('get_cart_shipping_cost', {
  cart_items: [
    { product_id: 'uuid-1', quantity: 2 },
    { product_id: 'uuid-2', variant_id: 'uuid-v1', quantity: 3 }
  ]
});

console.log(data.total_cost_with_type); // Costo total en USD

*/

-- =============================================================================
-- TESTING: Usar productos reales del carrito
-- =============================================================================

-- Test con los primeros 3 productos activos
WITH test_cart AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', p.id,
      'quantity', 1
    )
  ) as cart_items
  FROM (
    SELECT id 
    FROM products 
    WHERE is_active = TRUE 
    ORDER BY nombre 
    LIMIT 3
  ) p
)
SELECT 
  '🧪 Test con 3 productos reales' as test,
  result.*
FROM test_cart,
LATERAL calculate_cart_shipping_cost_dynamic(test_cart.cart_items) result;

-- =============================================================================
-- RESULTADO ESPERADO:
-- - total_items: 3
-- - total_weight_kg: suma real de pesos de los 3 productos
-- - total_cost_with_type: costo calculado en USD basado en peso real
-- =============================================================================
