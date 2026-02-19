-- ============================================================================
-- DIAGNÓSTICO: Error calculando costo de envío
-- ============================================================================
-- Este script verifica por qué falla get_user_cart_shipping_cost
-- ============================================================================

-- PASO 1: Verificar que los shipping_tiers tienen costos de tramos
-- ============================================================================

SELECT 
  '🔍 PASO 1: Verificar shipping_tiers con costos' as diagnostico;

SELECT 
  st.id,
  st.tier_name,
  st.transport_type,
  st.route_id,
  '──────────' as "───",
  st.tramo_a_cost_per_kg,
  st.tramo_a_cost_per_lb,
  '──────────' as " ───",
  st.tramo_b_cost_per_kg,
  st.tramo_b_cost_per_lb,
  '──────────' as "  ───",
  CASE 
    WHEN st.tramo_a_cost_per_kg IS NULL OR st.tramo_a_cost_per_kg = 0 
    THEN '❌ Tramo A vacío'
    WHEN st.tramo_b_cost_per_kg IS NULL OR st.tramo_b_cost_per_kg = 0 
    THEN '❌ Tramo B vacío'
    ELSE '✅ Configurado'
  END as estado
FROM shipping_tiers st
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

-- ============================================================================
-- PASO 2: Verificar si hay route_logistics_costs correspondientes
-- ============================================================================

SELECT 
  '🔍 PASO 2: Verificar route_logistics_costs (tramos)' as diagnostico;

SELECT 
  rlc.id,
  sr.name as ruta_nombre,
  rlc.segment as tramo,
  rlc.transport_type,
  rlc.cost_per_kg,
  rlc.estimated_days_min,
  rlc.estimated_days_max,
  CASE 
    WHEN rlc.cost_per_kg IS NULL OR rlc.cost_per_kg = 0 
    THEN '❌ Sin costo'
    ELSE '✅ OK'
  END as estado
FROM route_logistics_costs rlc
JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
WHERE rlc.is_active = TRUE
  AND rlc.segment IN ('china_to_transit', 'transit_to_destination')
ORDER BY sr.name, rlc.transport_type, rlc.segment;

-- ============================================================================
-- PASO 3: Verificar función calculate_shipping_cost_cart
-- ============================================================================

SELECT 
  '🔍 PASO 3: Verificar si existe calculate_shipping_cost_cart' as diagnostico;

SELECT 
  proname as nombre_funcion,
  prokind as tipo,
  prorettype::regtype as tipo_retorno,
  CASE 
    WHEN prokind = 'f' THEN '✅ Función existe'
    ELSE '❌ No es una función'
  END as estado
FROM pg_proc
WHERE proname = 'calculate_shipping_cost_cart'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- PASO 4: Verificar carrito de prueba
-- ============================================================================

SELECT 
  '🔍 PASO 4: Verificar carrito actual' as diagnostico;

SELECT 
  c.id as cart_id,
  c.buyer_user_id,
  COUNT(ci.id) as total_items,
  SUM(ci.quantity) as total_cantidad,
  CASE 
    WHEN COUNT(ci.id) = 0 THEN '⚠️  Carrito vacío'
    ELSE '✅ Tiene items'
  END as estado
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
WHERE c.status = 'open'
GROUP BY c.id, c.buyer_user_id
ORDER BY c.updated_at DESC
LIMIT 5;

-- ============================================================================
-- PASO 5: Verificar pesos de productos en carrito
-- ============================================================================

SELECT 
  '🔍 PASO 5: Verificar pesos de productos en carrito' as diagnostico;

SELECT 
  p.id as product_id,
  p.nombre,
  ci.quantity as cantidad_en_carrito,
  '──────────' as "───",
  p.peso_kg,
  p.peso_g,
  pv.peso_kg as variant_peso_kg,
  pv.peso_g as variant_peso_g,
  '──────────' as " ───",
  CASE 
    WHEN COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0) > 0 
    THEN '✅ Tiene peso'
    ELSE '❌ Sin peso'
  END as estado
FROM b2b_cart_items ci
JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
JOIN b2b_carts c ON ci.cart_id = c.id
WHERE c.status = 'open'
LIMIT 10;

-- ============================================================================
-- PASO 6: Prueba manual de get_user_cart_shipping_cost
-- ============================================================================

SELECT 
  '🔍 PASO 6: Intentar ejecutar get_user_cart_shipping_cost' as diagnostico;

-- NOTA: Reemplaza estos valores con user_id y shipping_type_id reales
-- Puedes obtenerlos de las queries anteriores

/*
SELECT get_user_cart_shipping_cost(
  'REEMPLAZA_CON_USER_ID'::uuid,
  'REEMPLAZA_CON_SHIPPING_TYPE_ID'::uuid
);
*/

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- ✅ Identificar qué paso está fallando
-- ✅ Ver si shipping_tiers tiene tramo_a_cost_per_kg y tramo_b_cost_per_kg
-- ✅ Verificar si la función calculate_shipping_cost_cart existe
-- ✅ Ver si el carrito tiene items con pesos
-- ============================================================================

SELECT 
  '📋 RESUMEN DE DIAGNÓSTICO' as titulo,
  'Revisa los resultados arriba para identificar el problema:' as instrucciones;

SELECT 
  'PASO 1' as paso,
  'Si shipping_tiers muestra "❌ Tramo A/B vacío" → Ejecuta TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql' as solucion
UNION ALL
SELECT 
  'PASO 2',
  'Si route_logistics_costs está vacío → Crea tramos en Admin → Logística → Rutas y Tramos'
UNION ALL
SELECT 
  'PASO 3',
  'Si calculate_shipping_cost_cart no existe → Contacta al equipo de desarrollo'
UNION ALL
SELECT 
  'PASO 4',
  'Si carrito vacío → Agrega productos al carrito primero'
UNION ALL
SELECT 
  'PASO 5',
  'Si productos sin peso → Actualiza peso_kg o peso_g en tabla products';
