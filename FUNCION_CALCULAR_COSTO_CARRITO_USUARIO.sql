-- =============================================================================
-- FUNCIÓN: get_user_cart_shipping_cost
-- Fecha: 2026-02-12
-- Propósito: Calcular costo de logística consultando el carrito desde la DB
-- =============================================================================

/*
DIFERENCIA ENTRE LAS DOS FUNCIONES:
====================================

1. get_cart_shipping_cost(cart_items JSONB)
   - Frontend pasa items explícitamente
   - Más flexible (puede ser carrito temporal, simulación, etc.)
   - Ideal cuando ya tienes items en memoria

2. get_user_cart_shipping_cost(user_id UUID) ← NUEVA
   - Consulta b2b_cart_items directamente desde DB
   - Más conveniente (solo necesitas user_id)
   - Ideal para calcular costo sin tener que construir array

CUÁNDO USAR CADA UNA:
======================

get_cart_shipping_cost():
  ✅ Ya tienes items en estado/memoria
  ✅ Quieres calcular costo de items específicos
  ✅ Estás simulando un carrito (no guardado aún)
  ✅ Testing con datos mock

get_user_cart_shipping_cost():
  ✅ Solo tienes el user_id
  ✅ Quieres el costo del carrito activo del usuario
  ✅ Más simple - un solo parámetro
  ✅ Backend jobs que calculan costos
*/

-- =============================================================================
-- CREAR FUNCIÓN: Consultar carrito del usuario y calcular costo
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_cart_shipping_cost(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_cart_items JSONB;
  v_result JSONB;
BEGIN
  -- 1. Construir array de items desde b2b_cart_items
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
  
  -- 2. Si no hay items, retornar costo cero
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
      'shipping_type_name', 'STANDARD',
      'shipping_type_display', 'Envío Estándar',
      'volume_m3', 0,
      'message', 'Carrito vacío'
    );
  END IF;
  
  -- 3. Llamar a la función dinámica con los items obtenidos
  SELECT get_cart_shipping_cost(v_cart_items)
  INTO v_result;
  
  -- 4. Agregar metadatos
  v_result := jsonb_set(
    v_result,
    '{user_id}',
    to_jsonb(p_user_id)
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_user_cart_shipping_cost IS 
  'Calcula costo de logística consultando el carrito activo del usuario desde la DB. Recibe solo user_id, consulta b2b_cart_items, y retorna costo total en USD.';


-- =============================================================================
-- FUNCIÓN ALTERNATIVA: Por cart_id en lugar de user_id
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_cart_id_shipping_cost(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_cart_id_shipping_cost(
  p_cart_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_cart_items JSONB;
BEGIN
  -- Construir array de items desde b2b_cart_items para este cart_id
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', ci.product_id,
      'variant_id', ci.variant_id,
      'quantity', ci.quantity
    )
  )
  INTO v_cart_items
  FROM public.b2b_cart_items ci
  WHERE ci.cart_id = p_cart_id
    AND ci.product_id IS NOT NULL;
  
  -- Si no hay items, retornar costo cero
  IF v_cart_items IS NULL OR jsonb_array_length(v_cart_items) = 0 THEN
    RETURN jsonb_build_object(
      'total_items', 0,
      'total_cost_with_type', 0,
      'message', 'Carrito vacío'
    );
  END IF;
  
  -- Llamar a la función dinámica
  RETURN get_cart_shipping_cost(v_cart_items);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_cart_id_shipping_cost IS 
  'Calcula costo de logística para un cart_id específico. Útil cuando tienes el ID del carrito.';


-- =============================================================================
-- EJEMPLOS DE USO
-- =============================================================================

/*
EJEMPLO 1: Calcular costo del carrito del usuario actual
----------------------------------------------------------

SELECT get_user_cart_shipping_cost('user-uuid-here');

Retorna:
{
  "user_id": "uuid",
  "total_items": 5,
  "total_weight_kg": 8.5,
  "total_cost_with_type": 69.30,
  ...
}


EJEMPLO 2: Calcular costo por cart_id específico
-------------------------------------------------

SELECT get_cart_id_shipping_cost('cart-uuid-here');


EJEMPLO 3: Comparar ambos métodos
----------------------------------

-- Método 1: Frontend pasa items (ACTUAL)
SELECT get_cart_shipping_cost('[
  {"product_id": "uuid1", "quantity": 2},
  {"product_id": "uuid2", "variant_id": "uuid-v1", "quantity": 3}
]'::jsonb);

-- Método 2: DB consulta items (NUEVO)
SELECT get_user_cart_shipping_cost('user-uuid');


DESDE FRONTEND:
---------------

// Opción A: Ya tienes items en memoria (usa función actual)
const { data } = await supabase.rpc('get_cart_shipping_cost', {
  cart_items: items.map(i => ({
    product_id: i.productId,
    variant_id: i.variantId,
    quantity: i.cantidad
  }))
});

// Opción B: Solo tienes user_id (usa nueva función)
const { data: user } = await supabase.auth.getUser();
const { data } = await supabase.rpc('get_user_cart_shipping_cost', {
  p_user_id: user.id
});

// Opción C: Tienes cart_id
const { data } = await supabase.rpc('get_cart_id_shipping_cost', {
  p_cart_id: cartId
});
*/


-- =============================================================================
-- TESTING: Verificar que funciona con datos reales
-- =============================================================================

-- Test 1: Ver usuarios con carritos activos
SELECT 
  c.buyer_user_id as user_id,
  c.id as cart_id,
  COUNT(ci.id) as items_count
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
WHERE c.status = 'open'
GROUP BY c.buyer_user_id, c.id
LIMIT 5;

-- Test 2: Calcular costo para el primer usuario con carrito
WITH first_user AS (
  SELECT buyer_user_id
  FROM b2b_carts
  WHERE status = 'open'
  LIMIT 1
)
SELECT 
  '🧪 Test: Costo del carrito del usuario' as test,
  get_user_cart_shipping_cost(buyer_user_id) as resultado
FROM first_user;


-- =============================================================================
-- RESULTADO ESPERADO:
-- - Consulta items desde b2b_cart_items
-- - Calcula peso total basado en productos reales
-- - Retorna mismo formato que get_cart_shipping_cost()
-- - total_cost_with_type en USD
-- =============================================================================


-- =============================================================================
-- CASOS DE USO RECOMENDADOS
-- =============================================================================

/*
USA get_cart_shipping_cost() CUANDO:
=====================================
✅ Frontend ya tiene items cargados en estado
✅ Quieres calcular costo de items específicos
✅ Estás en el componente del carrito con items en memoria
✅ Necesitas flexibilidad (calcular costo sin guardar en DB)
✅ Testing con datos mock

Ejemplo:
  const cartLogistics = useB2BCartLogistics(cartItems);
  // Internamente llama: get_cart_shipping_cost(cartItemsArray)


USA get_user_cart_shipping_cost() CUANDO:
==========================================
✅ Solo tienes user_id (no items en memoria)
✅ Backend job que calcula costos periódicamente
✅ API endpoint que retorna costo del carrito
✅ Dashboard admin mostrando costos de usuarios
✅ Email notifications con costo de carrito abandonado

Ejemplo:
  // Backend job
  FOR EACH user IN abandoned_carts:
    cost = get_user_cart_shipping_cost(user.id)
    SEND EMAIL with cost


USA get_cart_id_shipping_cost() CUANDO:
========================================
✅ Tienes cart_id específico
✅ Procesar multiple carritos de un usuario
✅ Histórico de carritos (status != 'open')

Ejemplo:
  // Ver costo de carrito específico
  SELECT get_cart_id_shipping_cost('cart-uuid');
*/
