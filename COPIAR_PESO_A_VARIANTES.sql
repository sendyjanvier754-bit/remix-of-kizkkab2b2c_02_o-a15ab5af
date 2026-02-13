-- =============================================================================
-- COPIAR PESO DEL PRODUCTO BASE A SUS VARIANTES
-- =============================================================================

-- PASO 1: Verificar peso actual del producto y sus variantes
SELECT 
  '📊 ANTES DE ACTUALIZAR' as info,
  'Producto Base' as tipo,
  p.id,
  p.nombre,
  p.peso_kg,
  p.peso_g
FROM products p
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'

UNION ALL

SELECT 
  '📊 ANTES DE ACTUALIZAR' as info,
  'Variante' as tipo,
  pv.id,
  pv.name,
  pv.peso_kg,
  pv.peso_g
FROM product_variants pv
WHERE pv.product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  );


-- =============================================================================
-- ACTUALIZACIÓN: Copiar peso del producto base a las variantes SIN peso
-- =============================================================================

-- Actualizar SOLO las variantes que NO tienen peso (peso_kg y peso_g son NULL)
-- Si la variante ya tiene su propio peso, NO se modifica
UPDATE product_variants pv
SET 
  peso_kg = p.peso_kg,
  peso_g = p.peso_g,
  updated_at = NOW()
FROM products p
WHERE pv.product_id = p.id
  AND pv.product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  )
  AND pv.peso_kg IS NULL    -- ← Solo si NO tiene peso_kg
  AND pv.peso_g IS NULL;    -- ← Solo si NO tiene peso_g


-- PASO 2: Verificar después de actualizar
SELECT 
  '✅ DESPUÉS DE ACTUALIZAR' as info,
  'Producto Base' as tipo,
  p.id,
  p.nombre,
  p.peso_kg,
  p.peso_g
FROM products p
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'

UNION ALL

SELECT 
  '✅ DESPUÉS DE ACTUALIZAR' as info,
  'Variante' as tipo,
  pv.id,
  pv.name,
  pv.peso_kg,
  pv.peso_g
FROM product_variants pv
WHERE pv.product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  );


-- PASO 3: Probar la función después de actualizar
WITH cart_json AS (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'product_id', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c',
      'variant_id', '30123456-0123-4567-8901-234567890123',
      'quantity', 1
    ),
    jsonb_build_object(
      'product_id', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c',
      'variant_id', '29012345-9012-3456-7890-123456789012',
      'quantity', 1
    )
  ) as cart_data
)
SELECT 
  '🧪 Test función DESPUÉS de actualizar peso' as info,
  (get_cart_shipping_cost(cart_data)->>'total_weight_kg')::numeric as peso_total_kg,
  (get_cart_shipping_cost(cart_data)->>'weight_rounded_kg')::numeric as peso_redondeado_kg,
  (get_cart_shipping_cost(cart_data)->>'total_cost_with_type')::numeric as costo_total_usd,
  (get_cart_shipping_cost(cart_data)->>'shipping_type_name')::text as tipo_envio
FROM cart_json;


-- PASO 4: Ver qué retorna ahora la vista v_cart_shipping_costs
SELECT 
  '🎯 Vista v_cart_shipping_costs (refrescar frontend)' as info,
  cart_id,
  buyer_user_id,
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  total_cost_with_type,
  shipping_type_name
FROM v_cart_shipping_costs;


-- =============================================================================
-- RESULTADO ESPERADO
-- =============================================================================
/*
ANTES DE ACTUALIZAR:
====================
- Producto base: peso_kg = 0.3 (o peso_g = 300)
- Variantes: peso_kg = NULL, peso_g = NULL ❌

DESPUÉS DE ACTUALIZAR:
======================
- Producto base: peso_kg = 0.3
- Variantes: peso_kg = 0.3 ✅

TEST FUNCIÓN:
=============
- total_weight_kg: 0.6 (2 variantes × 0.3 kg cada una)
- weight_rounded_kg: 1 (redondeado hacia arriba)
- total_cost_with_type: ~$11.05 (costo real de envío)

FRONTEND:
=========
Refresca la página /seller/carrito
El checkbox debería mostrar:
- ✅ Incluir Costo de Envío
- 1 kg - STANDARD
- $11.05

¡El costo de envío ya NO será $0.00!
*/
