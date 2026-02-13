-- =============================================================================
-- CONSULTA: Ver qué devuelve v_cart_shipping_costs
-- Propósito: Verificar estructura y datos de la vista estática
-- =============================================================================

/*
NOTA IMPORTANTE:
================
La vista v_cart_shipping_costs es ESTÁTICA - simula un carrito con 10 productos fijos.
NO refleja el carrito real del usuario.

Tu sistema actual USA la función dinámica get_cart_shipping_cost() que calcula
basado en items REALES del carrito.

Esta consulta es solo para comparación/referencia.
*/

-- =============================================================================
-- 1. Ver estructura y contenido completo de la vista
-- =============================================================================

SELECT 
  '📊 Contenido de v_cart_shipping_costs (VISTA ESTÁTICA)' as info,
  *
FROM v_cart_shipping_costs;


-- =============================================================================
-- 2. Ver solo campos principales (más legible)
-- =============================================================================

SELECT 
  '📦 Resumen de v_cart_shipping_costs' as info,
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 3) as "Peso Total (kg)",
  weight_rounded_kg as "Peso Redondeado (kg)",
  ROUND(base_cost::numeric, 2) as "Costo Base (USD)",
  ROUND(oversize_surcharge::numeric, 2) as "Surcharge Oversize (USD)",
  ROUND(dimensional_surcharge::numeric, 2) as "Surcharge Dimensional (USD)",
  ROUND(extra_cost::numeric, 2) as "Costo Extra (USD)",
  ROUND(total_cost_with_type::numeric, 2) as "💰 TOTAL (USD)",
  shipping_type_display as "Tipo Envío"
  -- route_name removido - no existe en la vista
FROM v_cart_shipping_costs;


-- =============================================================================
-- 3. Verificar qué productos usa la vista (si disponible)
-- =============================================================================

-- Nota: Esta query solo funciona si la vista expone los productos
-- Si no, comentar esta sección

/*
SELECT 
  '🔎 Productos usados en v_cart_shipping_costs' as info,
  product_id,
  product_name,
  weight_kg,
  quantity
FROM v_cart_shipping_costs
WHERE product_id IS NOT NULL;
*/


-- =============================================================================
-- 4. Comparar: Vista Estática vs Carrito Real del Usuario
-- =============================================================================

-- Paso A: Ver costo de la vista estática
WITH vista_estatica AS (
  SELECT 
    'Vista Estática (v_cart_shipping_costs)' as source,
    total_items,
    ROUND(total_weight_kg::numeric, 3) as peso_kg,
    ROUND(total_cost_with_type::numeric, 2) as costo_usd
  FROM v_cart_shipping_costs
)
SELECT * FROM vista_estatica;

-- Paso B: Ver costo del carrito REAL (requiere user_id)
-- Reemplaza 'USER-UUID-AQUI' con tu user_id real

/*
WITH carrito_real AS (
  SELECT 
    'Carrito Real (get_user_cart_shipping_cost)' as source,
    (resultado->>'total_items')::integer as total_items,
    ROUND((resultado->>'total_weight_kg')::numeric, 3) as peso_kg,
    ROUND((resultado->>'total_cost_with_type')::numeric, 2) as costo_usd
  FROM (
    SELECT get_user_cart_shipping_cost('USER-UUID-AQUI'::uuid) as resultado
  ) sub
)
SELECT * FROM carrito_real;
*/


-- =============================================================================
-- 5. Ver definición de la vista (si tienes permisos)
-- =============================================================================

SELECT 
  '📝 Definición de v_cart_shipping_costs' as info,
  pg_get_viewdef('v_cart_shipping_costs', true) as definicion;


-- =============================================================================
-- 6. Comparación lado a lado (COMPLETA)
-- =============================================================================

-- Para ejecutar esto, necesitas:
-- 1. Un user_id con carrito activo
-- 2. La vista v_cart_shipping_costs debe existir

/*
-- Obtener primer usuario con carrito
WITH user_with_cart AS (
  SELECT buyer_user_id
  FROM b2b_carts
  WHERE status = 'open'
  LIMIT 1
),

-- Vista estática
vista_data AS (
  SELECT 
    'VISTA ESTÁTICA' as tipo,
    total_items,
    ROUND(total_weight_kg::numeric, 3) as peso_kg,
    weight_rounded_kg,
    ROUND(base_cost::numeric, 2) as base_cost,
    ROUND(total_cost_with_type::numeric, 2) as total_cost
  FROM v_cart_shipping_costs
),

-- Carrito real
carrito_data AS (
  SELECT 
    'CARRITO REAL' as tipo,
    (resultado->>'total_items')::integer as total_items,
    ROUND((resultado->>'total_weight_kg')::numeric, 3) as peso_kg,
    (resultado->>'weight_rounded_kg')::numeric as weight_rounded_kg,
    ROUND((resultado->>'base_cost')::numeric, 2) as base_cost,
    ROUND((resultado->>'total_cost_with_type')::numeric, 2) as total_cost
  FROM user_with_cart,
  LATERAL (
    SELECT get_user_cart_shipping_cost(buyer_user_id) as resultado
  ) sub
)

-- Comparación
SELECT * FROM vista_data
UNION ALL
SELECT * FROM carrito_data
ORDER BY tipo DESC;
*/


-- =============================================================================
-- RESULTADO ESPERADO DE v_cart_shipping_costs:
-- =============================================================================

/*
┌─────────────────────┬──────────────────┐
│ Campo               │ Valor (Ejemplo)  │
├─────────────────────┼──────────────────┤
│ total_items         │ 10               │ ← Siempre 10 (fijo)
│ total_weight_kg     │ Varía            │ ← Suma de pesos de 10 productos
│ weight_rounded_kg   │ CEIL(peso)       │ ← Redondeado hacia arriba
│ base_cost           │ XX.XX USD        │ ← Tramo A + Tramo B
│ oversize_surcharge  │ 0 USD            │ ← +15% si hay oversize
│ dimensional_surcharge| 0 USD           │ ← +10% si volumen > 0.15 m³
│ extra_cost          │ 0 USD            │ ← +10% si tipo EXPRESS
│ total_cost_with_type│ XX.XX USD        │ ← TOTAL FINAL
│ shipping_type_display| Envío Estándar  │
│ route_name          │ China → Haití    │
└─────────────────────┴──────────────────┘

IMPORTANTE:
===========
La vista SIEMPRE retorna datos de los MISMOS 10 productos.
NO cambia según el usuario o su carrito real.

Tu sistema actual (correcto) usa get_cart_shipping_cost() que calcula
basado en los productos REALES del carrito de cada usuario.
*/


-- =============================================================================
-- QUERIES ÚTILES ADICIONALES
-- =============================================================================

-- Ver todos los usuarios con carrito y sus costos reales
/*
SELECT 
  c.buyer_user_id,
  COUNT(ci.id) as items_en_carrito,
  (get_user_cart_shipping_cost(c.buyer_user_id)->>'total_cost_with_type')::numeric as costo_logistica_usd
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
WHERE c.status = 'open'
GROUP BY c.buyer_user_id
LIMIT 10;
*/

-- Ver diferencia entre vista estática y carrito más pesado
/*
WITH vista AS (
  SELECT total_cost_with_type as costo_vista
  FROM v_cart_shipping_costs
),
carrito_mas_pesado AS (
  SELECT 
    buyer_user_id,
    (get_user_cart_shipping_cost(buyer_user_id)->>'total_cost_with_type')::numeric as costo_real
  FROM b2b_carts
  WHERE status = 'open'
  ORDER BY (get_user_cart_shipping_cost(buyer_user_id)->>'total_weight_kg')::numeric DESC
  LIMIT 1
)
SELECT 
  'Vista Estática' as tipo,
  costo_vista as costo_usd
FROM vista
UNION ALL
SELECT 
  'Carrito Más Pesado' as tipo,
  costo_real as costo_usd
FROM carrito_mas_pesado;
*/
