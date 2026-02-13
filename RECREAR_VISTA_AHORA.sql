-- =============================================================================
-- RE-CREAR VISTA v_cart_shipping_costs (después de actualizar funciones)
-- Ejecutar AHORA para que use las funciones con fix de columnas
-- =============================================================================

DROP VIEW IF EXISTS public.v_cart_shipping_costs CASCADE;

CREATE OR REPLACE VIEW public.v_cart_shipping_costs AS
WITH 
-- Obtener el user_id del usuario autenticado actual
current_user_id AS (
  SELECT auth.uid() as user_id
),

-- Obtener items del carrito del usuario ACTUAL
user_cart_items AS (
  SELECT 
    ci.product_id,
    ci.variant_id,
    ci.quantity
  FROM public.b2b_cart_items ci
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN current_user_id
  WHERE c.buyer_user_id = current_user_id.user_id
    AND c.status = 'open'
    AND ci.product_id IS NOT NULL
),

-- Construir array de items en formato JSONB
cart_items_array AS (
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'variant_id', variant_id,
          'quantity', quantity
        )
      ),
      '[]'::jsonb
    ) as items
  FROM user_cart_items
),

-- Calcular costo usando la función dinámica (AHORA con fix de columnas)
shipping_cost AS (
  SELECT 
    CASE 
      WHEN jsonb_array_length(items) > 0 
      THEN get_cart_shipping_cost(items)  -- ← Usa función actualizada
      ELSE jsonb_build_object(
        'total_items', 0,
        'total_weight_kg', 0,
        'weight_rounded_kg', 0,
        'base_cost', 0,
        'oversize_surcharge', 0,
        'dimensional_surcharge', 0,
        'extra_cost', 0,
        'total_cost_with_type', 0,
        'shipping_type_name', 'STANDARD',
        'shipping_type_display', 'Envío Estándar',
        'volume_m3', 0
      )
    END as result
  FROM cart_items_array
)

-- Extraer campos del JSONB resultado
SELECT 
  (result->>'total_items')::INTEGER as total_items,
  (result->>'total_weight_kg')::NUMERIC as total_weight_kg,
  (result->>'weight_rounded_kg')::NUMERIC as weight_rounded_kg,
  (result->>'base_cost')::NUMERIC as base_cost,
  (result->>'oversize_surcharge')::NUMERIC as oversize_surcharge,
  (result->>'dimensional_surcharge')::NUMERIC as dimensional_surcharge,
  (result->>'extra_cost')::NUMERIC as extra_cost,
  (result->>'total_cost_with_type')::NUMERIC as total_cost_with_type,
  (result->>'shipping_type_name')::VARCHAR as shipping_type_name,
  (result->>'shipping_type_display')::VARCHAR as shipping_type_display,
  (result->>'volume_m3')::NUMERIC as volume_m3
FROM shipping_cost;

COMMENT ON VIEW public.v_cart_shipping_costs IS 
  'Vista DINÁMICA que muestra el costo de logística del carrito del usuario autenticado actual. Usa las funciones actualizadas con fix de columnas peso_kg/peso_g.';

-- =============================================================================
-- TEST: Verificar que ahora funciona
-- =============================================================================

-- Esto debería mostrar 0 en SQL Editor (no hay auth.uid())
SELECT * FROM v_cart_shipping_costs;

-- Pero en frontend con usuario autenticado debería mostrar $29.05 ✅
