-- =============================================================================
-- DIAGNÓSTICO: ¿Por qué v_cart_shipping_costs retorna $0.00?
-- =============================================================================

-- PASO 1: Verificar si la vista existe y qué retorna
SELECT 
  '📊 Datos de v_cart_shipping_costs para el usuario actual' as info,
  cart_id,
  buyer_user_id,
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  extra_cost,
  total_cost_with_type,
  shipping_type_name,
  shipping_type_display,
  volume_m3
FROM v_cart_shipping_costs;


-- PASO 2: Ver qué hay en el carrito del usuario actual
-- Simular con un usuario conocido: rsdorvil21@gmail.com
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '🛒 Carrito del usuario rsdorvil21@gmail.com' as info,
  c.id as cart_id,
  c.buyer_user_id,
  c.status,
  COUNT(ci.id) as total_items
FROM b2b_carts c
CROSS JOIN user_data
LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
WHERE c.buyer_user_id = user_data.user_id
  AND c.status = 'open'
GROUP BY c.id, c.buyer_user_id, c.status;


-- PASO 3: Ver los items del carrito con sus pesos
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '📦 Items en el carrito con pesos' as info,
  ci.id as cart_item_id,
  ci.product_id,
  p.nombre as product_name,
  ci.variant_id,
  pv.name as variant_name,
  ci.quantity,
  -- Pesos del producto
  p.peso_kg as product_peso_kg,
  p.peso_g as product_peso_g,
  -- Pesos de la variante
  pv.peso_kg as variant_peso_kg,
  pv.peso_g as variant_peso_g,
  -- Peso calculado (prioridad: variant_peso_kg > product_peso_kg > conversión de gramos)
  COALESCE(
    pv.peso_kg,
    p.peso_kg,
    pv.peso_g::numeric / 1000.0,
    p.peso_g::numeric / 1000.0,
    0
  ) as peso_calculado_kg,
  -- Peso total para este item
  COALESCE(
    pv.peso_kg,
    p.peso_kg,
    pv.peso_g::numeric / 1000.0,
    p.peso_g::numeric / 1000.0,
    0
  ) * ci.quantity as peso_total_item_kg
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
CROSS JOIN user_data
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = user_data.user_id
  AND c.status = 'open';


-- PASO 4: Calcular peso total del carrito manualmente
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
cart_weights AS (
  SELECT 
    ci.id,
    ci.quantity,
    COALESCE(
      pv.peso_kg,
      p.peso_kg,
      pv.peso_g::numeric / 1000.0,
      p.peso_g::numeric / 1000.0,
      0
    ) as peso_unitario_kg,
    COALESCE(
      pv.peso_kg,
      p.peso_kg,
      pv.peso_g::numeric / 1000.0,
      p.peso_g::numeric / 1000.0,
      0
    ) * ci.quantity as peso_total_kg
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  LEFT JOIN products p ON ci.product_id = p.id
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
)
SELECT 
  '⚖️ Peso total del carrito (calculado manualmente)' as info,
  SUM(peso_total_kg) as peso_total_sin_redondear_kg,
  CEIL(SUM(peso_total_kg)) as peso_redondeado_kg,
  COUNT(*) as total_items
FROM cart_weights;


-- PASO 5: Verificar si hay tarifas de envío configuradas
SELECT 
  '💰 Tarifas de envío en logistics_fees' as info,
  lf.id,
  lr.name as route_name,
  lr.origin,
  lr.destination,
  lf.weight_from_kg,
  lf.weight_to_kg,
  lf.base_cost,
  lf.cost_per_kg
FROM logistics_fees lf
JOIN logistics_routes lr ON lf.route_id = lr.id
WHERE lr.id = '21420dcb-9d8a-4947-8530-aaf3519c9047'  -- China → Haití
ORDER BY lf.weight_from_kg;


-- PASO 6: Verificar tipos de envío disponibles
SELECT 
  '🚚 Tipos de envío (shipping_types)' as info,
  id,
  name,
  display_name,
  is_default,
  surcharge_percentage,
  surcharge_fixed,
  is_active
FROM shipping_types
WHERE is_active = true
ORDER BY is_default DESC, name;


-- PASO 7: Simular el cálculo que debería hacer la función
-- Usando el peso del carrito y las tarifas configuradas
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
cart_weight AS (
  SELECT 
    SUM(
      COALESCE(
        pv.peso_kg,
        p.peso_kg,
        pv.peso_g::numeric / 1000.0,
        p.peso_g::numeric / 1000.0,
        0
      ) * ci.quantity
    ) as total_weight_kg
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  LEFT JOIN products p ON ci.product_id = p.id
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
),
rounded_weight AS (
  SELECT 
    total_weight_kg,
    CEIL(total_weight_kg) as weight_rounded_kg
  FROM cart_weight
),
applicable_fee AS (
  SELECT 
    lf.base_cost,
    lf.cost_per_kg,
    lf.weight_from_kg,
    lf.weight_to_kg,
    rw.weight_rounded_kg
  FROM rounded_weight rw
  CROSS JOIN logistics_fees lf
  WHERE lf.route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
    AND rw.weight_rounded_kg >= lf.weight_from_kg
    AND (rw.weight_rounded_kg <= lf.weight_to_kg OR lf.weight_to_kg IS NULL)
  LIMIT 1
)
SELECT 
  '🧮 Simulación del cálculo de costo' as info,
  rw.total_weight_kg as peso_sin_redondear,
  rw.weight_rounded_kg as peso_redondeado,
  af.base_cost as tarifa_base,
  af.cost_per_kg as costo_por_kg,
  af.weight_from_kg as rango_desde,
  af.weight_to_kg as rango_hasta,
  -- Calcular costo extra (peso redondeado - peso mínimo del rango) * costo_por_kg
  CASE 
    WHEN rw.weight_rounded_kg > af.weight_from_kg 
    THEN (rw.weight_rounded_kg - af.weight_from_kg) * af.cost_per_kg
    ELSE 0
  END as costo_extra,
  -- Costo total
  af.base_cost + 
  CASE 
    WHEN rw.weight_rounded_kg > af.weight_from_kg 
    THEN (rw.weight_rounded_kg - af.weight_from_kg) * af.cost_per_kg
    ELSE 0
  END as costo_total_calculado
FROM rounded_weight rw
LEFT JOIN applicable_fee af ON true;


-- PASO 8: Ver la definición de la vista v_cart_shipping_costs
SELECT 
  '🔍 Definición de v_cart_shipping_costs' as info,
  pg_get_viewdef('v_cart_shipping_costs'::regclass, true) as definicion;


-- PASO 9: Probar directamente la función calculate_cart_shipping_cost_dynamic
-- Construir el JSON del carrito manualmente
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
cart_json AS (
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as cart_data
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
)
SELECT 
  '🧪 Test directo de calculate_cart_shipping_cost_dynamic' as info,
  cj.cart_data,
  calculate_cart_shipping_cost_dynamic(cj.cart_data) as resultado
FROM cart_json cj;


-- =============================================================================
-- RESUMEN DE DIAGNÓSTICO
-- =============================================================================
/*
Este script diagnostica por qué v_cart_shipping_costs retorna $0.00:

POSIBLES CAUSAS:
================
1. ❌ Productos sin peso: peso_kg y peso_g son NULL
2. ❌ Carrito vacío: No hay items en b2b_cart_items
3. ❌ Sin tarifas: No hay registros en logistics_fees para la ruta
4. ❌ Rango incorrecto: El peso no coincide con ningún rango en logistics_fees
5. ❌ Función incorrecta: calculate_cart_shipping_cost_dynamic tiene un bug
6. ❌ RLS bloqueando: Las políticas de seguridad impiden acceso a datos

CÓMO INTERPRETAR RESULTADOS:
============================
- PASO 1: Si retorna NULL o 0, la vista no encuentra datos
- PASO 3: Si todos los pesos son 0, los productos no tienen peso configurado
- PASO 4: Si peso_total es 0, el carrito está vacío o sin pesos
- PASO 5: Si no hay filas, no hay tarifas configuradas para la ruta
- PASO 7: Muestra lo que DEBERÍA calcularse con los datos actuales
- PASO 9: Prueba la función directamente con el carrito del usuario
*/
