-- =============================================================================
-- VERIFICAR: ¿Los productos del carrito tienen peso configurado?
-- =============================================================================

-- PASO 1: Ver usuario actual y su carrito
WITH user_info AS (
  SELECT 
    '👤 Usuario y Carrito Actual' as info,
    au.id as user_id,
    au.email,
    c.id as cart_id,
    c.status,
    COUNT(ci.id) as total_items_en_carrito
  FROM auth.users au
  LEFT JOIN b2b_carts c ON c.buyer_user_id = au.id AND c.status = 'open'
  LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
  WHERE au.email = 'rsdorvil21@gmail.com'
  GROUP BY au.id, au.email, c.id, c.status
)
SELECT * FROM user_info;


-- PASO 2: Ver TODOS los items del carrito con detalles de peso
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
)
SELECT 
  '📦 Items del carrito con pesos' as info,
  ci.id as cart_item_id,
  ci.product_id,
  p.nombre as product_name,
  ci.variant_id,
  pv.name as variant_name,
  ci.quantity as cantidad,
  
  -- Pesos del PRODUCTO
  p.peso_kg as product_peso_kg,
  p.peso_g as product_peso_g,
  CASE 
    WHEN p.peso_kg IS NOT NULL THEN '✅ Tiene peso_kg'
    WHEN p.peso_g IS NOT NULL THEN '✅ Tiene peso_g'
    ELSE '❌ SIN PESO'
  END as product_peso_status,
  
  -- Pesos de la VARIANTE
  pv.peso_kg as variant_peso_kg,
  pv.peso_g as variant_peso_g,
  CASE 
    WHEN ci.variant_id IS NULL THEN 'N/A - Sin variante'
    WHEN pv.peso_kg IS NOT NULL THEN '✅ Tiene peso_kg'
    WHEN pv.peso_g IS NOT NULL THEN '✅ Tiene peso_g'
    ELSE '❌ SIN PESO'
  END as variant_peso_status,
  
  -- Peso CALCULADO (lógica de la función)
  COALESCE(
    pv.peso_kg,
    p.peso_kg,
    pv.peso_g::numeric / 1000.0,
    p.peso_g::numeric / 1000.0,
    0
  ) as peso_calculado_kg,
  
  -- Peso TOTAL para este item
  COALESCE(
    pv.peso_kg,
    p.peso_kg,
    pv.peso_g::numeric / 1000.0,
    p.peso_g::numeric / 1000.0,
    0
  ) * ci.quantity as peso_total_item_kg,
  
  -- DIAGNÓSTICO
  CASE 
    WHEN COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) > 0 
    THEN '✅ OK'
    ELSE '❌ PROBLEMA: Sin peso configurado'
  END as diagnostico
  
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
CROSS JOIN user_data
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.buyer_user_id = user_data.user_id
  AND c.status = 'open'
ORDER BY diagnostico DESC, ci.created_at;


-- PASO 3: Resumen de problemas con pesos
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
item_weights AS (
  SELECT 
    ci.id,
    ci.product_id,
    ci.variant_id,
    ci.quantity,
    p.nombre as product_name,
    COALESCE(
      pv.peso_kg,
      p.peso_kg,
      pv.peso_g::numeric / 1000.0,
      p.peso_g::numeric / 1000.0,
      0
    ) as peso_calculado_kg
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  LEFT JOIN products p ON ci.product_id = p.id
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
)
SELECT 
  '📊 RESUMEN DE PESOS' as info,
  COUNT(*) as total_items,
  COUNT(CASE WHEN peso_calculado_kg > 0 THEN 1 END) as items_con_peso,
  COUNT(CASE WHEN peso_calculado_kg = 0 THEN 1 END) as items_sin_peso,
  SUM(peso_calculado_kg * quantity) as peso_total_carrito_kg,
  CEIL(SUM(peso_calculado_kg * quantity)) as peso_redondeado_kg
FROM item_weights;


-- PASO 4: Listar productos SIN peso configurado
WITH user_data AS (
  SELECT id as user_id FROM auth.users WHERE email = 'rsdorvil21@gmail.com'
),
items_sin_peso AS (
  SELECT 
    ci.id as cart_item_id,
    ci.product_id,
    p.nombre as product_name,
    ci.variant_id,
    pv.name as variant_name,
    ci.quantity,
    p.peso_kg as product_peso_kg,
    p.peso_g as product_peso_g,
    pv.peso_kg as variant_peso_kg,
    pv.peso_g as variant_peso_g
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  CROSS JOIN user_data
  LEFT JOIN products p ON ci.product_id = p.id
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  WHERE c.buyer_user_id = user_data.user_id
    AND c.status = 'open'
    AND COALESCE(
      pv.peso_kg,
      p.peso_kg,
      pv.peso_g::numeric / 1000.0,
      p.peso_g::numeric / 1000.0,
      0
    ) = 0
)
SELECT 
  '❌ ITEMS SIN PESO CONFIGURADO' as info,
  *
FROM items_sin_peso;


-- PASO 5: Ver qué retorna la función get_cart_shipping_cost con estos datos
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
  '🧪 Resultado de get_cart_shipping_cost()' as info,
  cart_data as input_json,
  get_cart_shipping_cost(cart_data) as output_json
FROM cart_json;


-- =============================================================================
-- INTERPRETACIÓN DE RESULTADOS
-- =============================================================================
/*
CÓMO LEER LOS RESULTADOS:
=========================

PASO 1: Información básica
- Si cart_id es NULL → El usuario no tiene carrito activo
- Si total_items_en_carrito = 0 → El carrito está vacío

PASO 2: Detalles de cada item
- Busca la columna "diagnostico"
- ❌ PROBLEMA: Sin peso configurado → Ese producto necesita peso
- ✅ OK → El producto tiene peso correcto

PASO 3: Resumen general
- items_sin_peso > 0 → HAY PRODUCTOS SIN PESO (problema)
- peso_total_carrito_kg = 0 → TODOS los productos sin peso
- peso_redondeado_kg → Esto es lo que debería usar para calcular costo

PASO 4: Lista de productos problemáticos
- Si aparecen filas → Estos productos necesitan peso configurado
- Si vacío → Todos los productos tienen peso ✅

PASO 5: Output de la función
- total_cost_with_type = 0 → No calcula costo (probablemente sin peso)
- total_weight_kg = 0 → Confirma que no hay peso en el carrito

SOLUCIONES SI HAY PRODUCTOS SIN PESO:
=====================================
1. Ir a la tabla 'products' y agregar peso_kg o peso_g
2. Si tiene variantes, agregar peso_kg o peso_g a 'product_variants'
3. Usar ACTUALIZAR_PESOS_VARIANTES.sql para actualizar en masa
4. Verificar con este script nuevamente
*/
