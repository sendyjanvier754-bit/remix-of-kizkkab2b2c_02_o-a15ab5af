-- =============================================================================
-- SOLUCIÓN: Agregar campo peso_kg a b2b_cart_items
-- =============================================================================
-- 
-- IMPORTANTE: 
-- - Cada variante puede tener peso diferente
-- - Guardamos el peso ESPECÍFICO de esa variante al agregarla al carrito
-- - Si variante tiene peso propio → se guarda ese peso
-- - Si variante no tiene peso → se guarda el peso del producto base
-- - Esto preserva el peso exacto de cada variante en el momento de la compra
--
-- =============================================================================

-- PASO 1: Agregar columna peso_kg a b2b_cart_items
ALTER TABLE b2b_cart_items
ADD COLUMN IF NOT EXISTS peso_kg NUMERIC(10,3) DEFAULT NULL;

COMMENT ON COLUMN b2b_cart_items.peso_kg IS 
  'Peso específico de esta variante/producto guardado al momento de agregar al carrito. Cada variante puede tener peso diferente.';

-- PASO 2: Actualizar items existentes con el peso usando COALESCE directo
-- Esto calcula el peso específico para cada combinación product_id + variant_id
-- Cada fila puede tener un peso diferente (variantes con pesos propios)
UPDATE b2b_cart_items bci
SET peso_kg = (
  CASE 
    WHEN bci.variant_id IS NOT NULL THEN
      -- Item tiene variante: usar lógica COALESCE completa
      -- NULLIF trata 0 como NULL para que revise peso_g
      (SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = bci.variant_id)
    ELSE
      -- Item sin variante: usar peso del producto
      (SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0)
       FROM products p
       WHERE p.id = bci.product_id)
  END
)
WHERE bci.peso_kg IS NULL;

-- PASO 3: Ver items actualizados
SELECT 
  '✅ ITEMS ACTUALIZADOS CON PESO' as info,
  bci.id,
  bc.buyer_user_id,
  p.nombre as producto,
  pv.name as variante,
  bci.quantity,
  bci.peso_kg as "peso_guardado_en_cart",
  -- Calcular peso actual de la variante/producto para comparar
  CASE 
    WHEN bci.variant_id IS NOT NULL THEN
      COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
    ELSE
      COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0)
  END as "peso_actual_calculado",
  CASE 
    WHEN bci.peso_kg IS NOT NULL THEN '✅ Peso guardado'
    ELSE '❌ Sin peso'
  END as status
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
ORDER BY bci.created_at DESC;

-- PASO 4: Ver el costo de envío ahora
SELECT 
  '💰 COSTO DE ENVÍO NUEVO (usando peso_kg)' as info,
  bc.id as cart_id,
  COUNT(bci.id) as total_items,
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as total_weight_kg,
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as weight_rounded_kg,
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as total_cost
FROM b2b_carts bc
JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
GROUP BY bc.id;

-- =============================================================================
-- RESULTADO ESPERADO
-- =============================================================================
/*
EJEMPLO: Producto con 3 variantes de pesos diferentes
=======================================================

Producto Base: Camiseta (peso: 0.2 kg)
- Variante S: 0.18 kg (más liviana)
- Variante M: 0.2 kg (usa peso del producto) 
- Variante XL: 0.25 kg (más pesada)

EN EL CARRITO:
--------------
Cart Item 1: Camiseta S → peso_kg = 0.18 ✅
Cart Item 2: Camiseta M → peso_kg = 0.2 ✅
Cart Item 3: Camiseta XL → peso_kg = 0.25 ✅
Cart Item 4: Camiseta S (otra) → peso_kg = 0.18 ✅

COSTO DE ENVÍO:
---------------
Total weight = (0.18 × 1) + (0.2 × 1) + (0.25 × 1) + (0.18 × 1) = 0.81 kg
Rounded = 1 kg → Costo = $11.05 ✅

VENTAJAS DE ESTA SOLUCIÓN:
==========================
✅ Cada variante tiene su peso específico guardado
✅ Peso se calcula UNA VEZ al agregar al carrito
✅ No depende de consultas complejas en tiempo real
✅ Peso queda "congelado" (histórico de la compra)
✅ Si el producto cambia después, el carrito mantiene el peso original
✅ Cálculo de shipping ultra rápido (SUM simple)
✅ Trigger automático garantiza futuras variantes con peso

EJEMPLO REAL CON TUS DATOS:
============================
Producto: 3f61c5dc-ed1c-491a-894e-44ae6d1e380c (Camiseta, peso: 0.3 kg)
- Variante 1 (S): antes NULL → ahora 0.3 kg (heredado) ✅
- Variante 2 (M): antes NULL → ahora 0.3 kg (heredado) ✅

Si después creas:
- Variante 3 (XL con peso propio 0.35 kg) → se guarda 0.35 kg ✅

Carrito tendrá:
- Item 1: Variante S → peso_kg = 0.3
- Item 2: Variante M → peso_kg = 0.3  
- Item 3: Variante XL → peso_kg = 0.35
Total = 0.95 kg → 1 kg → $11.05

PRÓXIMO PASO:
=============
1. Ejecutar este script (AGREGAR_PESO_A_CART_ITEMS.sql)
2. Ejecutar FUNCION_GET_PRODUCT_WEIGHT.sql
3. Ejecutar TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql
4. Actualizar useB2BCartSupabase.ts para llamar get_product_weight()
5. Actualizar v_cart_shipping_costs para usar bci.peso_kg
*/
