-- ===========================================================================
-- ACTUALIZAR VISTA: v_cart_shipping_costs para que sea DINÁMICA por usuario
-- Fecha: 2026-02-12
-- Cambio: De 10 productos fijos → Items REALES del carrito del usuario actual
-- ===========================================================================

/*
PROBLEMA ANTERIOR:
==================
v_cart_shipping_costs usaba 10 productos FIJOS simulados.
TODOS los usuarios veían el MISMO costo sin importar su carrito.

SOLUCIÓN:
=========
Usar auth.uid() de Supabase para obtener el user_id del usuario autenticado.
La vista ahora consulta b2b_cart_items del usuario ACTUAL y calcula costo REAL.

VENTAJAS:
=========
✅ Cada usuario ve SOLO su carrito
✅ Cálculo basado en items REALES
✅ Frontend simplificado: SELECT * FROM v_cart_shipping_costs (sin params)
✅ Usa RLS automáticamente
✅ Más seguro - no puede ver carritos de otros usuarios
*/

-- =============================================================================
-- PASO 1: Drop vista actual (respaldo antes)
-- =============================================================================

-- IMPORTANTE: Hacer respaldo primero si es necesario
-- pg_dump -t v_cart_shipping_costs ...

DROP VIEW IF EXISTS public.v_cart_shipping_costs CASCADE;


-- =============================================================================
-- PASO 2: Crear nueva vista DINÁMICA basada en usuario autenticado
-- =============================================================================

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
  'Vista DINÁMICA que muestra el costo de logística del carrito del usuario autenticado actual. Usa auth.uid() para filtrar por usuario. Cada usuario ve SOLO su carrito.';


-- =============================================================================
-- PASO 3: Habilitar RLS en la vista (opcional pero recomendado)
-- =============================================================================

-- Nota: Las vistas heredan RLS de las tablas base, pero podemos ser explícitos
-- No es estrictamente necesario ya que auth.uid() ya filtra


-- =============================================================================
-- TESTING: Verificar que funciona
-- =============================================================================

-- Test 1: Ver tu propio carrito (como usuario autenticado)
SELECT * FROM v_cart_shipping_costs;

-- Resultado esperado:
-- - Si tienes items en tu carrito: muestra costo calculado
-- - Si carrito vacío: total_items = 0, costs = 0


-- Test 2: Comparar con función directa
SELECT 
  'Vista Dinámica' as source,
  total_items,
  ROUND(total_weight_kg::numeric, 3) as peso_kg,
  ROUND(total_cost_with_type::numeric, 2) as costo_usd
FROM v_cart_shipping_costs

UNION ALL

SELECT 
  'Función get_user_cart_shipping_cost' as source,
  (result->>'total_items')::integer as total_items,
  ROUND((result->>'total_weight_kg')::numeric, 3) as peso_kg,
  ROUND((result->>'total_cost_with_type')::numeric, 2) as costo_usd
FROM (
  SELECT get_user_cart_shipping_cost(auth.uid()) as result
) sub;

-- Ambos deberían dar el MISMO resultado


-- =============================================================================
-- USO EN FRONTEND (SIMPLIFICADO)
-- =============================================================================

/*
ANTES (Opción A - Función con parámetros):
------------------------------------------
const { data } = await supabase.rpc('get_cart_shipping_cost', {
  cart_items: items.map(i => ({
    product_id: i.productId,
    variant_id: i.variantId,
    quantity: i.cantidad
  }))
});


AHORA (Vista dinámica - MÁS SIMPLE):
------------------------------------
const { data } = await supabase
  .from('v_cart_shipping_costs')
  .select('*')
  .single();

// Retorna automáticamente el costo del usuario autenticado
console.log(data.total_cost_with_type); // Costo en USD


VENTAJAS:
=========
✅ Código más simple (no construir array de items)
✅ Una sola línea de código
✅ Usa el carrito REAL del usuario automáticamente
✅ Seguro - cada usuario ve solo su carrito
✅ Mismo resultado que la función pero más fácil de usar
*/


-- =============================================================================
-- ACTUALIZAR HOOK DE FRONTEND (OPCIONAL)
-- =============================================================================

/*
Archivo: src/hooks/useB2BCartLogistics.ts

OPCIÓN 1: Mantener función actual (más flexible):
-------------------------------------------------
// Sigue funcionando exactamente igual
const { data } = await supabase.rpc('get_cart_shipping_cost', {
  cart_items: cartItemsForShipping
});


OPCIÓN 2: Cambiar a vista dinámica (más simple):
------------------------------------------------
const { data: cartShippingCost } = useQuery({
  queryKey: ['cart-shipping-cost'],  // Más simple sin items
  queryFn: async () => {
    const { data, error } = await supabase
      .from('v_cart_shipping_costs')
      .select('*')
      .single();
    
    if (error) {
      console.error('Error fetching cart shipping cost:', error);
      return null;
    }
    
    return data;
  },
  enabled: items.length > 0,
});

// data ya tiene: total_cost_with_type, base_cost, etc.


RECOMENDACIÓN:
==============
Puedes usar AMBAS opciones según el caso:

- Vista (v_cart_shipping_costs): Para UI principal del carrito
- Función (get_cart_shipping_cost): Para simulaciones o items temporales

O migrar todo a la vista para simplificar el código.
*/


-- =============================================================================
-- ROLLBACK (Si algo sale mal)
-- =============================================================================

/*
-- Para volver a la vista anterior (10 productos fijos):

DROP VIEW IF EXISTS public.v_cart_shipping_costs CASCADE;

-- Luego ejecutar el SQL original de la vista estática
-- (debería estar en: VISTAS_FUNCIONES_SHIPPING_CORREGIDA.sql)
*/


-- =============================================================================
-- RESULTADO ESPERADO
-- =============================================================================

/*
┌────────────────────────────────────────────────────────────┐
│ ANTES: Vista Estática                                      │
├────────────────────────────────────────────────────────────┤
│ SELECT * FROM v_cart_shipping_costs;                       │
│ → Usuario A: 10 items, $29.05 (fijo)                      │
│ → Usuario B: 10 items, $29.05 (fijo)                      │
│ → Usuario C: 10 items, $29.05 (fijo)                      │
│ ❌ TODOS ven lo mismo                                      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ AHORA: Vista Dinámica                                      │
├────────────────────────────────────────────────────────────┤
│ SELECT * FROM v_cart_shipping_costs;                       │
│ → Usuario A: 2 items, $14.52 (su carrito)                 │
│ → Usuario B: 15 items, $87.30 (su carrito)                │
│ → Usuario C: 0 items, $0.00 (carrito vacío)               │
│ ✅ Cada usuario ve SU carrito real                         │
└────────────────────────────────────────────────────────────┘
*/
