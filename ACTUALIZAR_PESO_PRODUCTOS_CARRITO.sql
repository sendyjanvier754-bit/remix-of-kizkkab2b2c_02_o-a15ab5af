-- =============================================================================
-- VERIFICAR Y ACTUALIZAR PESO DE LOS PRODUCTOS EN EL CARRITO
-- =============================================================================

-- PASO 1: Ver los productos específicos del carrito
SELECT 
  '🔍 Productos en el carrito' as info,
  p.id as product_id,
  p.nombre,
  p.peso_kg,
  p.peso_g,
  CASE 
    WHEN p.peso_kg IS NOT NULL OR p.peso_g IS NOT NULL THEN '✅ Tiene peso'
    ELSE '❌ SIN PESO'
  END as status_producto
FROM products p
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c';


-- PASO 2: Ver las variantes específicas
SELECT 
  '🔍 Variantes en el carrito' as info,
  pv.id as variant_id,
  pv.product_id,
  pv.name as variant_name,
  pv.peso_kg,
  pv.peso_g,
  CASE 
    WHEN pv.peso_kg IS NOT NULL OR pv.peso_g IS NOT NULL THEN '✅ Tiene peso'
    ELSE '❌ SIN PESO'
  END as status_variante
FROM product_variants pv
WHERE pv.id IN (
  '30123456-0123-4567-8901-234567890123',
  '29012345-9012-3456-7890-123456789012'
);


-- PASO 3: Ver peso del producto base y heredar a variantes
SELECT 
  '📊 Relación producto -> variantes' as info,
  p.id as product_id,
  p.nombre as product_name,
  p.peso_kg as product_peso_kg,
  p.peso_g as product_peso_g,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.peso_kg as variant_peso_kg,
  pv.peso_g as variant_peso_g
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  );


-- =============================================================================
-- ACTUALIZACIÓN: Agregar peso a los productos
-- =============================================================================

-- OPCIÓN A: Si el producto base tiene peso, copiar a variantes
-- (Ejecutar solo si el producto ya tiene peso configurado)
/*
UPDATE product_variants
SET 
  peso_kg = (SELECT peso_kg FROM products WHERE id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'),
  peso_g = (SELECT peso_g FROM products WHERE id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'),
  updated_at = NOW()
WHERE product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  );
*/


-- OPCIÓN B: Agregar peso manualmente al producto base
-- (Ajusta el peso según corresponda - ejemplo: 0.15 kg para una tanga)
/*
UPDATE products
SET 
  peso_kg = 0.15,  -- ← AJUSTAR ESTE VALOR
  peso_g = NULL,   -- Dejar NULL si usas peso_kg
  updated_at = NOW()
WHERE id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c';
*/


-- OPCIÓN C: Agregar peso directamente a las variantes
-- (Usa esto si cada variante tiene peso diferente)
/*
-- Variante 1 (L - Talla Grande puede pesar más)
UPDATE product_variants
SET 
  peso_kg = 0.16,  -- ← AJUSTAR ESTE VALOR
  peso_g = NULL,
  updated_at = NOW()
WHERE id = '30123456-0123-4567-8901-234567890123';

-- Variante 2 (M - Talla Mediana)
UPDATE product_variants
SET 
  peso_kg = 0.14,  -- ← AJUSTAR ESTE VALOR
  peso_g = NULL,
  updated_at = NOW()
WHERE id = '29012345-9012-3456-7890-123456789012';
*/


-- OPCIÓN D: Peso por defecto para todas las variantes sin peso
-- (Útil si hay muchas variantes)
/*
UPDATE product_variants pv
SET 
  peso_kg = COALESCE(
    pv.peso_kg,
    (SELECT peso_kg FROM products p WHERE p.id = pv.product_id),
    0.15  -- ← Peso por defecto si no hay ninguno
  ),
  updated_at = NOW()
WHERE pv.product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.peso_kg IS NULL
  AND pv.peso_g IS NULL;
*/


-- =============================================================================
-- VERIFICACIÓN DESPUÉS DE ACTUALIZAR
-- =============================================================================

-- Ejecutar después de hacer UPDATE
SELECT 
  '✅ Verificación post-actualización' as info,
  p.nombre as producto,
  p.peso_kg as product_peso_kg,
  pv.name as variante,
  pv.peso_kg as variant_peso_kg,
  COALESCE(pv.peso_kg, p.peso_kg, 0) as peso_final_kg
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
  AND pv.id IN (
    '30123456-0123-4567-8901-234567890123',
    '29012345-9012-3456-7890-123456789012'
  );


-- Probar nuevamente la función después de actualizar
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
  '🧪 Test función después de actualizar' as info,
  get_cart_shipping_cost(cart_data) as resultado
FROM cart_json;


-- =============================================================================
-- RESUMEN Y SIGUIENTES PASOS
-- =============================================================================
/*
DIAGNÓSTICO:
============
❌ Los productos en el carrito NO tienen peso configurado
❌ total_weight_kg = 0 → Por eso el costo de envío es $0.00

SOLUCIÓN RÁPIDA:
================
1. Ejecuta PASO 1, 2 y 3 para ver el estado actual
2. Descomenta y ejecuta OPCIÓN B para agregar peso al producto base (ej: 0.15 kg)
3. Descomenta y ejecuta OPCIÓN A para copiar el peso a las variantes
4. Ejecuta la VERIFICACIÓN para confirmar
5. Refresca el frontend - el costo de envío debería aparecer

PESOS SUGERIDOS (para tangas/ropa interior):
=============================================
- Tanga/Bikini pequeño: 0.08 - 0.12 kg (80-120 gramos)
- Tanga/Bikini mediano: 0.12 - 0.15 kg (120-150 gramos)
- Tanga/Bikini grande: 0.15 - 0.18 kg (150-180 gramos)

Si es un producto diferente, ajusta el peso según corresponda.
*/
