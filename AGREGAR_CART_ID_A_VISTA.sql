-- =============================================================================
-- ACTUALIZAR v_cart_shipping_costs para incluir cart_id
-- =============================================================================

DROP VIEW IF EXISTS public.v_cart_shipping_costs CASCADE;

CREATE OR REPLACE VIEW public.v_cart_shipping_costs AS
WITH 
-- Obtener el user_id del usuario autenticado actual
current_user_id AS (
  SELECT auth.uid() as user_id
),

-- Obtener el carrito activo del usuario ACTUAL
user_active_cart AS (
  SELECT 
    c.id as cart_id,
    c.buyer_user_id
  FROM public.b2b_carts c
  CROSS JOIN current_user_id
  WHERE c.buyer_user_id = current_user_id.user_id
    AND c.status = 'open'
  LIMIT 1  -- Solo el carrito activo más reciente
),

-- Obtener items del carrito del usuario ACTUAL
user_cart_items AS (
  SELECT 
    ci.product_id,
    ci.variant_id,
    ci.quantity
  FROM public.b2b_cart_items ci
  JOIN user_active_cart uac ON ci.cart_id = uac.cart_id
  WHERE ci.product_id IS NOT NULL
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

-- Calcular costo usando la función dinámica
shipping_cost AS (
  SELECT 
    CASE 
      WHEN jsonb_array_length(items) > 0 
      THEN get_cart_shipping_cost(items)
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

-- Extraer campos del JSONB resultado + agregar cart_id
SELECT 
  uac.cart_id,
  uac.buyer_user_id,
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
FROM shipping_cost
CROSS JOIN user_active_cart uac;

COMMENT ON VIEW public.v_cart_shipping_costs IS 
  'Vista que muestra el costo de logística del carrito activo del usuario autenticado. Incluye cart_id y buyer_user_id.';

-- =============================================================================
-- TEST: Verificar que retorna datos correctamente
-- =============================================================================

-- Esto debería mostrar cart_id y buyer_user_id además de los costos
SELECT * FROM v_cart_shipping_costs;

-- =============================================================================
-- EXPLICACIÓN
-- =============================================================================
/*
CAMBIOS REALIZADOS:
==================
✅ Agregado cart_id a la vista
✅ Agregado buyer_user_id a la vista
✅ La vista ahora devuelve el carrito activo específico del usuario
✅ Se mantiene toda la lógica de cálculo de costos

COLUMNAS DE LA VISTA:
=====================
1. cart_id                 → UUID del carrito activo
2. buyer_user_id           → UUID del usuario comprador
3. total_items             → Cantidad total de items
4. total_weight_kg         → Peso total sin redondear
5. weight_rounded_kg       → Peso redondeado hacia arriba
6. base_cost               → Costo base de la tarifa
7. oversize_surcharge      → Recargo por sobredimensión
8. dimensional_surcharge   → Recargo dimensional
9. extra_cost              → Costo extra por peso adicional
10. total_cost_with_type   → Costo total con tipo de envío
11. shipping_type_name     → Nombre del tipo de envío
12. shipping_type_display  → Nombre para mostrar
13. volume_m3              → Volumen total en m³

USO EN FRONTEND:
================
const { data: cartShippingCost } = useCartShippingCostView();

// Ahora puedes acceder a:
cartShippingCost.cart_id              // UUID del carrito
cartShippingCost.buyer_user_id        // UUID del usuario
cartShippingCost.total_cost_with_type // Costo total
cartShippingCost.weight_rounded_kg    // Peso
*/
