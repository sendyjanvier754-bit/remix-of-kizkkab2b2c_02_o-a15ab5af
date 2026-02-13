-- ===========================================================================
-- VERIFICAR: ¿Hay items en el carrito de la base de datos?
-- ===========================================================================

-- 1. Ver todos los carritos del usuario
SELECT 
  '🛒 Carritos del usuario' as info,
  id as cart_id,
  buyer_user_id,
  status,
  created_at,
  updated_at
FROM b2b_carts
WHERE buyer_user_id = auth.uid()
ORDER BY created_at DESC;


-- 2. Ver items de TODOS los carritos del usuario (incluso cerrados)
SELECT 
  '📦 Items en carritos (todos)' as info,
  c.id as cart_id,
  c.status as cart_status,
  ci.id as item_id,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  ci.created_at
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
WHERE c.buyer_user_id = auth.uid()
ORDER BY c.created_at DESC, ci.created_at DESC;


-- 3. Verificar si tienes carrito OPEN
SELECT 
  '✅ Carrito OPEN del usuario' as info,
  c.id as cart_id,
  c.status,
  COUNT(ci.id) as total_items
FROM b2b_carts c
LEFT JOIN b2b_cart_items ci ON c.id = ci.cart_id
WHERE c.buyer_user_id = auth.uid()
  AND c.status = 'open'
GROUP BY c.id, c.status;


-- 4. Verificar user_id actual
SELECT 
  '👤 Usuario autenticado' as info,
  auth.uid() as user_id;


-- =============================================================================
-- DIAGNÓSTICO
-- =============================================================================

/*
PROBLEMA IDENTIFICADO:
======================
❌ Array JSONB = NULL → NO hay items en b2b_cart_items

POSIBLES CAUSAS:
================

1. ❌ Carrito es LOCAL en el frontend (no sincronizado con DB)
   - Items solo en React State
   - NO guardados en b2b_cart_items

2. ❌ Carrito de GUEST user (no autenticado)
   - Frontend muestra carrito temporal
   - DB requiere auth.uid() para guardar

3. ❌ Items se borraron accidentalmente
   - Trigger que limpia items?
   - Proceso que vació el carrito?

4. ❌ Usuario tiene múltiples carritos
   - Carrito con items está con status != 'open'
   - Vista solo busca status = 'open'

SOLUCIÓN:
=========
Ejecuta las queries arriba para identificar:
a) ¿Tienes carrito en la DB?
b) ¿El carrito está vacío o tiene items?
c) ¿Los items están en un carrito con status diferente?

Si NO tienes items en DB pero SÍ en frontend:
→ Necesitas sincronizar el carrito local con la base de datos
→ Usa la función addToCart() que guarda en b2b_cart_items
*/
