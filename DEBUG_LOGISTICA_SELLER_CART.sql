-- =============================================================================
-- DEBUG: ¿Por qué muestra $5.00 en lugar del valor esperado?
-- =============================================================================

-- PASO 0: Obtener UUID del usuario por email
WITH user_data AS (
  SELECT 
    id as user_id,
    email
  FROM auth.users
  WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '👤 Usuario encontrado' as info,
  user_id,
  email
FROM user_data;


-- PASO 1: ¿Qué items tiene el carrito del usuario actual?
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '🛒 Items en el carrito del usuario' as info,
  ci.id as cart_item_id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  p.nombre as product_name,
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_kg,
  (COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) * ci.quantity) as peso_total_item
FROM public.b2b_cart_items ci
JOIN public.b2b_carts c ON ci.cart_id = c.id
CROSS JOIN user_data
JOIN public.products p ON ci.product_id = p.id
LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = user_data.user_id
  AND c.status = 'open'
  AND ci.product_id IS NOT NULL;


-- PASO 2: ¿Qué devuelve la vista v_cart_shipping_costs?
-- NOTA: La vista usa auth.uid() que es NULL en SQL Editor, por eso mostrará 0
-- Esta consulta es solo para verificar que la vista está creada correctamente
SELECT 
  '📊 Resultado de v_cart_shipping_costs (usará auth.uid() = NULL)' as info,
  total_items,
  ROUND(total_weight_kg::numeric, 3) as peso_total_kg,
  weight_rounded_kg as peso_redondeado_kg,
  ROUND(base_cost::numeric, 2) as costo_base_usd,
  ROUND(oversize_surcharge::numeric, 2) as surcharge_oversize,
  ROUND(dimensional_surcharge::numeric, 2) as surcharge_dimensional,
  ROUND(extra_cost::numeric, 2) as costo_extra,
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL_USD (esperado: 0)",
  shipping_type_display as tipo_envio
FROM v_cart_shipping_costs;

user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
cart_items_jsonb AS (
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', ci.product_id,
          'variant_id', ci.variant_id,
          'quantity', ci.quantity
        )
      ),
      '[]'::jsonb
    ) as items
  FROM public.b2b_cart_items ci
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  WHERE c.buyer_user_id = user_data.user_id
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  WHERE c.buyer_user_id = auth.uid()
    AND c.status = 'open'
    AND ci.product_id IS NOT NULL
)
SELECT 
  '📋 Items en formato JSONB' as info,
  jsonb_pretty(items) as cart_items_array
FROM cart_items_jsonb; (ESTE ES EL CÁLCULO REAL)
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
cart_items_jsonb AS (
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', ci.product_id,
          'variant_id', ci.variant_id,
          'quantity', ci.quantity
        )
      ),
      '[]'::jsonb
    ) as items
  FROM public.b2b_cart_items ci
  JOIN public.b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
    AND ci.product_id IS NOT NULL
)
SELECT 
  '⚙️ Resultado de get_cart_shipping_cost() - VALOR REAL' as info,
  (get_cart_shipping_cost(items)->>'total_items')::integer as "Items",
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '⚖️ Pesos configurados en productos del carrito' as info,
  p.id as product_id,
  p.nombre,
  p.peso_kg as "peso_kg (products)",
  p.peso_g as "peso_g (products)",
  pv.id as variant_id,
  pv.name as variant_name,
  pv.peso_kg as "peso_kg (variant)",
  pv.peso_g as "peso_g (variant)",
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_final_kg,
  ci.quantity,
  ROUND((COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) * ci.quantity), 3) as peso_total_item
FROM public.b2b_cart_items ci
JOIN public.b2b_carts c ON ci.cart_id = c.id
CROSS JOIN user_data
JOIN public.products p ON ci.product_id = p.id
LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = user_data.user_id",
  p.peso_g as "peso_g (products)",
  pv.id as variant_id,
  pv.name as variant_name,
  pv.peso_kg as "peso_kg (variant)",
  pv.peso_g as "peso_g (variant)",
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as peso_final_kg,
  ci.quantity,
  (COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) * ci.quantity) as peso_total_item
FROM public.b2b_cart_items ci
JOIN public.b2b_carts c ON ci.cart_id = c.id
JOIN public.products p ON ci.product_id = p.id
LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = auth.uid()
  AND c.status = 'open'
  AND ci.product_id IS NOT NULL;


-- PASO 6: Verificar configuración de rutas y tipos de envío
SELECT 
  '🚛 Rutas de envío disponibles' as info,
  sr.id,
  th.code as origen,
  dc.code as destino,
  sr.is_active,
  sr.estimated_delivery_days_min,
  sr.estimated_delivery_days_max
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE sr.is_active = TRUE;


-- PASO 7: Ver matriz de costos de envío
SELECT 
  '💵 Matriz de costos de envío' as info,
  scm.id,
  scm.weight_from_kg,
  scm.weight_to_kg,
  scm.cost_per_kg_usd,
  scm.cost_per_lb_usd,
  scm.is_active
FROM shipping_cost_matrix scm
WHERE scm.is_active = TRUE
ORDER BY scm.weight_from_kg;


-- =============================================================================
-- RESUMEN
-- =============================================================================
-- Esta consulta te ayudará a diagnosticar:
-- 1. ¿Cuántos items hay en el carrito?
-- 2. ¿Qué peso tienen esos items?
-- 3. ¿Qué está calculando la vista?
-- 4. ¿Qué está devolviendo la función?
-- 5. ¿Hay problemas con los pesos configurados?
-- 6. ¿Está usando la ruta correcta?
-- 7. ¿Está usando la matriz de costos correcta?
