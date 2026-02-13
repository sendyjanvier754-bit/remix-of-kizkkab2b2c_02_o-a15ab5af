-- ===========================================================================
-- SOLUCIÓN: Actualizar pesos de productos/variantes a 0.300 kg (300g)
-- ===========================================================================

-- PROBLEMA IDENTIFICADO:
-- Todos los items tienen peso_g = 0
-- Por eso el costo es bajo ($5.00 en vez de $14.52)

-- 1. Ver qué variantes están en el carrito y sus pesos actuales
SELECT 
  '📦 Variantes en carrito' as info,
  pv.id as variant_id,
  pv.name as variante,
  pv.weight_g as "Peso Actual (g)",
  p.weight_g as "Peso Producto (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) as "Peso Usado (g)"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open';


-- 2. ACTUALIZAR: Asignar 300g a las variantes del carrito
-- (Ajusta los IDs según la query anterior)

-- OPCIÓN A: Si conoces los variant_ids específicos
/*
UPDATE product_variants
SET weight_g = 300
WHERE id IN (
  'variant_id_1',
  'variant_id_2',
  'variant_id_3',
  'variant_id_4'
);
*/

-- OPCIÓN B: Actualizar TODAS las variantes de los items en carrito open
UPDATE product_variants pv
SET weight_g = 300,
    updated_at = NOW()
WHERE pv.id IN (
  SELECT DISTINCT ci.variant_id
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
    AND ci.variant_id IS NOT NULL
);

-- Ver cuántas variantes se actualizaron
SELECT 
  '✅ Variantes actualizadas' as info,
  COUNT(*) as total
FROM product_variants pv
WHERE pv.id IN (
  SELECT DISTINCT ci.variant_id
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
    AND ci.variant_id IS NOT NULL
);


-- 3. Verificar que ahora tienen peso
SELECT 
  '✅ Verificar pesos actualizados' as info,
  pv.id as variant_id,
  pv.name as variante,
  pv.weight_g as "Peso Nuevo (g)",
  pv.weight_g / 1000.0 as "Peso (kg)"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open';


-- 4. Recalcular costo después de actualizar pesos
WITH carrito_open AS (
  SELECT c.id as cart_id
  FROM b2b_carts c
  WHERE c.status = 'open'
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
  '💰 Costo recalculado' as info,
  (get_cart_shipping_cost(items)->>'total_items')::integer as total_items,
  ROUND((get_cart_shipping_cost(items)->>'total_weight_kg')::numeric, 3) as peso_kg,
  (get_cart_shipping_cost(items)->>'weight_rounded_kg')::numeric as peso_redondeado,
  ROUND((get_cart_shipping_cost(items)->>'base_cost')::numeric, 2) as costo_base,
  ROUND((get_cart_shipping_cost(items)->>'total_cost_with_type')::numeric, 2) as costo_total_usd
FROM cart_items_json;


-- =============================================================================
-- RESULTADO ESPERADO DESPUÉS DE UPDATE
-- =============================================================================

/*
CON 4 variantes × 300g × 1 cantidad = 1,200g = 1.2 kg:
=======================================================

Peso total: 1.200 kg
Peso redondeado: CEIL(1.2) = 2 kg
Tramo A: 2 × 3.50 = $7.00
Tramo B: 2 × 2.20462 × 5.00 = $22.05
TOTAL: $29.05 USD ✅

Si solo 2 variantes:
====================
Peso total: 0.600 kg
Peso redondeado: CEIL(0.6) = 1 kg
Tramo A: 1 × 3.50 = $3.50
Tramo B: 1 × 2.20462 × 5.00 = $11.02
TOTAL: $14.52 USD ✅
*/
