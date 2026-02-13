-- ===========================================================================
-- VERIFICAR: ¿Qué columnas de peso existen y tienen valores?
-- ===========================================================================

-- 1. Ver estructura de la tabla products (columnas de peso)
SELECT 
  '📊 Columnas de peso en products' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND (
    column_name LIKE '%weight%'
    OR column_name LIKE '%peso%'
  )
ORDER BY ordinal_position;


-- 2. Ver estructura de la tabla product_variants (columnas de peso)
SELECT 
  '📊 Columnas de peso en product_variants' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_variants'
  AND (
    column_name LIKE '%weight%'
    OR column_name LIKE '%peso%'
  )
ORDER BY ordinal_position;


-- 3. Ver valores REALES de peso para productos del carrito
SELECT 
  '⚖️ Pesos REALES de productos en carrito' as info,
  p.id as product_id,
  pv.id as variant_id,
  -- Intentar todas las columnas posibles
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'weight_kg'
  ) THEN 'p.weight_kg existe' ELSE 'p.weight_kg NO existe' END as peso_kg_check,
  
  p.weight_g as "p.weight_g",
  pv.weight_g as "pv.weight_g",
  
  COALESCE(pv.weight_g, p.weight_g, 0) as "Peso Final (g)",
  COALESCE(pv.weight_g, p.weight_g, 0) / 1000.0 as "Peso Final (kg)"
FROM b2b_cart_items ci
JOIN b2b_carts c ON ci.cart_id = c.id
LEFT JOIN products p ON ci.product_id = p.id
LEFT JOIN product_variants pv ON ci.variant_id = pv.id
WHERE c.status = 'open';


-- 4. Simular lo que hace la función (EXACTO)
-- Esto es lo que calculate_cart_shipping_cost_dynamic hace internamente
WITH cart_items AS (
  SELECT 
    ci.product_id,
    ci.variant_id,
    ci.quantity
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
)
SELECT 
  '🔍 Simulación de función' as info,
  ci.product_id,
  ci.variant_id,
  ci.quantity,
  
  -- Lo que la función intenta obtener (variante):
  CASE 
    WHEN ci.variant_id IS NOT NULL THEN
      (
        SELECT COALESCE(
          -- pv.weight_kg,  -- NO EXISTE
          -- p.weight_kg,   -- NO EXISTE  
          -- p.peso_kg,     -- NO EXISTE
          pv.weight_g / 1000.0,  -- DEBERÍA FUNCIONAR si weight_g tiene valor
          p.weight_g / 1000.0,   -- FALLBACK
          -- p.peso_g / 1000.0, -- NO EXISTE
          0  -- DEFAULT
        )
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = ci.variant_id
      )
    ELSE
      -- Lo que la función intenta obtener (producto):
      (
        SELECT COALESCE(
          -- p.weight_kg,   -- NO EXISTE
          -- p.peso_kg,     -- NO EXISTE
          p.weight_g / 1000.0,  -- DEBERÍA FUNCIONAR si weight_g tiene valor
          -- p.peso_g / 1000.0, -- NO EXISTE
          0  -- DEFAULT
        )
        FROM products p
        WHERE p.id = ci.product_id
      )
  END as peso_calculado_kg,
  
  -- Peso total con cantidad:
  (
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN
        (
          SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.id = ci.variant_id
        )
      ELSE
        (
          SELECT COALESCE(p.weight_g / 1000.0, 0)
          FROM products p
          WHERE p.id = ci.product_id
        )
    END * ci.quantity
  ) as peso_total_item_kg

FROM cart_items ci;


-- 5. SUMA TOTAL de peso del carrito (lo que debería calcular)
WITH cart_items AS (
  SELECT 
    ci.product_id,
    ci.variant_id,
    ci.quantity
  FROM b2b_cart_items ci
  JOIN b2b_carts c ON ci.cart_id = c.id
  WHERE c.status = 'open'
)
SELECT 
  '💰 Cálculo total del carrito' as info,
  SUM(
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN
        (
          SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.id = ci.variant_id
        )
      ELSE
        (
          SELECT COALESCE(p.weight_g / 1000.0, 0)
          FROM products p
          WHERE p.id = ci.product_id
        )
    END * ci.quantity
  ) as peso_total_kg,
  CEIL(SUM(
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN
        (
          SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.id = ci.variant_id
        )
      ELSE
        (
          SELECT COALESCE(p.weight_g / 1000.0, 0)
          FROM products p
          WHERE p.id = ci.product_id
        )
    END * ci.quantity
  )) as peso_redondeado_kg,
  CEIL(SUM(
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN
        (
          SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.id = ci.variant_id
        )
      ELSE
        (
          SELECT COALESCE(p.weight_g / 1000.0, 0)
          FROM products p
          WHERE p.id = ci.product_id
        )
    END * ci.quantity
  )) * 3.50 as tramo_a_usd,
  CEIL(SUM(
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN
        (
          SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.id = ci.variant_id
        )
      ELSE
        (
          SELECT COALESCE(p.weight_g / 1000.0, 0)
          FROM products p
          WHERE p.id = ci.product_id
        )
    END * ci.quantity
  )) * 2.20462 * 5.00 as tramo_b_usd,
  (
    CEIL(SUM(
      CASE 
        WHEN ci.variant_id IS NOT NULL THEN
          (
            SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.id = ci.variant_id
          )
        ELSE
          (
            SELECT COALESCE(p.weight_g / 1000.0, 0)
            FROM products p
            WHERE p.id = ci.product_id
          )
      END * ci.quantity
    )) * 3.50
  ) + (
    CEIL(SUM(
      CASE 
        WHEN ci.variant_id IS NOT NULL THEN
          (
            SELECT COALESCE(pv.weight_g / 1000.0, p.weight_g / 1000.0, 0)
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.id = ci.variant_id
          )
        ELSE
          (
            SELECT COALESCE(p.weight_g / 1000.0, 0)
            FROM products p
            WHERE p.id = ci.product_id
          )
      END * ci.quantity
    )) * 2.20462 * 5.00
  ) as total_esperado_usd
FROM cart_items ci;


-- =============================================================================
-- DIAGNÓSTICO
-- =============================================================================

/*
RESULTADOS ESPERADOS:
=====================

Query 1-2: Ver qué columnas existen
→ Deberían mostrar: weight_g (si existe)
→ NO deberían existir: weight_kg, peso_kg, peso_g

Query 3: Ver valores reales
→ Si weight_g = 0 o NULL: PROBLEMA - productos sin peso
→ Si weight_g > 0: CORRECTO - tienen peso

Query 4: Simulación de función
→ Si peso_calculado_kg = 0: productos sin peso o columna no existe
→ Si peso_calculado_kg > 0: función debería funcionar

Query 5: Cálculo total
→ Si peso_total_kg = 0: PROBLEMA - productos sin peso
→ Si peso_total_kg > 0: Ver total_esperado_usd (debería ser $14.52 para 0.6kg)

SOLUCIÓN SEGÚN RESULTADO:
=========================

Si weight_g = 0:
→ Ejecutar ACTUALIZAR_PESOS_VARIANTES.sql

Si weight_g > 0 pero peso_calculado_kg = 0:
→ Problema en la función (columnas incorrectas)
→ Necesitamos ver v_product_shipping_costs

Si todo correcto pero frontend muestra $5:
→ Problema de caché del frontend
→ Limpiar caché de React Query
*/
