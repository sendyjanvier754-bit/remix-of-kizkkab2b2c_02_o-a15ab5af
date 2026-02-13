-- ===========================================================================
-- VERIFICAR: Definición de la vista y tabla correcta
-- ===========================================================================

-- 1. Ver definición completa de v_cart_shipping_costs
SELECT 
  '📋 Definición de la vista' as info,
  pg_get_viewdef('v_cart_shipping_costs', true) as definicion;


-- 2. Verificar que tabla usa (sin auth.uid - para testing)
-- Buscar un carrito OPEN con items
WITH carrito_ejemplo AS (
  SELECT 
    c.id as cart_id,
    c.buyer_user_id,
    COUNT(ci.id) as items_count
  FROM b2b_carts c
  LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
  WHERE c.status = 'open'
  GROUP BY c.id, c.buyer_user_id
  HAVING COUNT(ci.id) > 0
  LIMIT 1
)
SELECT 
  '🛒 Carrito de ejemplo' as info,
  cart_id,
  buyer_user_id,
  items_count
FROM carrito_ejemplo;


-- 3. Ver items del primer carrito OPEN con items (SIN auth.uid)
SELECT 
  '📦 Items del carrito open' as info,
  ci.id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  pv.name as variante,
  COALESCE(pv.weight_g, p.weight_g, 0) as peso_g,
  (COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 * ci.quantity) as peso_total_kg
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open'
  AND c.id IN (
    SELECT c2.id 
    FROM b2b_carts c2
    LEFT JOIN b2b_cart_items ci2 ON c2.id = ci2.cart_id
    WHERE c2.status = 'open'
    GROUP BY c2.id
    HAVING COUNT(ci2.id) > 0
    LIMIT 1
  )
ORDER BY ci.id;


-- 4. Calcular costo manualmente para ese carrito (SIN auth.uid)
WITH carrito_open AS (
  SELECT c.id as cart_id
  FROM b2b_carts c
  LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
  WHERE c.status = 'open'
  GROUP BY c.id
  HAVING COUNT(ci.id) > 0
  LIMIT 1
),
cart_items_json AS (
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'variant_id', ci.variant_id,
        'quantity', ci.quantity
      )
    ) as items
  FROM b2b_cart_items ci
  JOIN carrito_open co ON ci.cart_id = co.cart_id
)
SELECT 
  '⚙️ Test función con carrito real' as info,
  (get_cart_shipping_cost(items)->>'total_items')::integer as total_items,
  ROUND((get_cart_shipping_cost(items)->>'total_weight_kg')::numeric, 3) as peso_kg,
  (get_cart_shipping_cost(items)->>'weight_rounded_kg')::numeric as peso_redondeado,
  ROUND((get_cart_shipping_cost(items)->>'total_cost_with_type')::numeric, 2) as costo_usd
FROM cart_items_json;


-- 5. Ver TODOS los b2b_cart_items (hay 4 según la tabla)
SELECT 
  '📊 TODOS los b2b_cart_items' as info,
  ci.id,
  ci.cart_id,
  c.status as cart_status,
  c.buyer_user_id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  pv.name as variante,
  COALESCE(pv.weight_g, p.weight_g, 0) as peso_g
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
ORDER BY c.status, ci.id;


-- =============================================================================
-- DIAGNÓSTICO DEL PROBLEMA
-- =============================================================================

/*
PROBLEMA IDENTIFICADO:
======================
❌ auth.uid() = NULL en SQL Editor
   → Vista no puede encontrar items del usuario
   → Retorna carrito vacío ($0.00)

PERO:
=====
✅ b2b_cart_items tiene 4 items (tabla muestra 4 rows)
✅ Todos los productos tienen peso configurado
✅ Frontend está autenticado (muestra $5.00)

¿POR QUÉ $5.00 en vez de $14.52?
=================================

OPCIÓN 1: Caché del Frontend
-----------------------------
- Frontend tiene valor cacheado antiguo
- React Query no refrescó después de actualizar vista
- Solución: Limpiar caché o hacer hard refresh

OPCIÓN 2: Vista no actualizada en producción
---------------------------------------------
- Actualizaste la vista en SQL Editor
- Pero no se reflejó en la conexión del frontend
- Solución: Verificar que se ejecutó CREATE OR REPLACE VIEW

OPCIÓN 3: Tabla incorrecta
---------------------------
- Frontend consultando tabla diferente
- O función usando lógica antigua
- Solución: Verificar definición de vista (query 1)

TESTING EN FRONTEND:
====================
1. Abre DevTools (F12)
2. Ve a Console
3. Ejecuta:
   
   // Limpiar caché de React Query
   queryClient.invalidateQueries(['cart-shipping-cost'])
   
   // Ver request real
   await supabase.from('v_cart_shipping_costs').select('*').single()

4. Verifica el resultado
5. Si aún muestra $5.00, la vista no está actualizada

PRÓXIMOS PASOS:
===============
1. Ejecutar query 1 para ver definición actual de la vista
2. Confirmar que usa b2b_cart_items (no b2c_cart_items)
3. Ver query 4 para calcular costo con carrito REAL
4. Comparar con $5.00 del frontend
*/
