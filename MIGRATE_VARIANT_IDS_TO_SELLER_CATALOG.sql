-- =====================================================
-- MIGRAR variant_id A seller_catalog DESDE PRODUCTO VARIANTS
-- =====================================================
-- Este script asigna los variant_id correctos a los registros
-- existentes en seller_catalog usando matching por SKU
-- =====================================================

-- =============================================================================
-- DIAGNÓSTICO: Ver productos con variantes en seller_catalog
-- =============================================================================

SELECT 
  '🔍 DIAGNÓSTICO: Productos duplicados sin variant_id' as info,
  source_product_id,
  COUNT(*) as total_registros,
  array_agg(DISTINCT sku ORDER BY sku) as skus,
  array_agg(DISTINCT id) as catalog_ids,
  SUM(stock) as stock_total
FROM seller_catalog
WHERE source_product_id IS NOT NULL
GROUP BY source_product_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- =============================================================================
-- PASO 1: Actualizar variant_id usando SKU matching
-- =============================================================================
-- Buscar en product_variants y hacer match por SKU

UPDATE seller_catalog sc
SET variant_id = pv.id
FROM product_variants pv
WHERE sc.variant_id IS NULL
  AND sc.source_product_id = pv.product_id
  AND sc.sku = pv.sku;

-- Verificar cuántos se actualizaron
SELECT 
  '✅ ACTUALIZADOS POR SKU' as resultado,
  COUNT(*) as total_con_variant_id
FROM seller_catalog
WHERE variant_id IS NOT NULL;

-- =============================================================================
-- PASO 2: Verificar cuántos quedan sin asignar
-- =============================================================================
-- Ver cuántos registros aún no tienen variant_id después del match por SKU

SELECT 
  '⚠️ SIN VARIANT_ID DESPUÉS DE SKU MATCH' as alerta,
  COUNT(*) as total_sin_variant,
  array_agg(DISTINCT sku) as skus_sin_variant
FROM seller_catalog
WHERE variant_id IS NULL
  AND source_product_id IS NOT NULL;

-- =============================================================================
-- PASO 3: Consolidar duplicados existentes PRIMERO
-- =============================================================================
-- Mantiene el registro más reciente y suma el stock
-- ESTO DEBE HACERSE ANTES DE CREAR EL CONSTRAINT

-- Ver duplicados que se van a consolidar
WITH duplicados AS (
  SELECT 
    source_product_id,
    seller_store_id,
    variant_id,
    COUNT(*) as total,
    array_agg(id ORDER BY created_at DESC) as ids,
    array_agg(stock ORDER BY created_at DESC) as stocks
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY source_product_id, seller_store_id, variant_id
  HAVING COUNT(*) > 1
)
SELECT 
  '⚠️ DUPLICADOS ENCONTRADOS' as alerta,
  d.source_product_id,
  d.seller_store_id,
  d.variant_id,
  d.total as registros_duplicados,
  d.stocks as stocks_actuales,
  (SELECT nombre FROM seller_catalog WHERE id = d.ids[1]) as nombre_producto
FROM duplicados d;

-- Actualizar el stock del registro que se va a mantener (el más reciente)
WITH duplicados AS (
  SELECT 
    source_product_id,
    seller_store_id,
    variant_id,
    (array_agg(id ORDER BY created_at DESC))[1] as keep_id,
    SUM(stock) as total_stock
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY source_product_id, seller_store_id, variant_id
  HAVING COUNT(*) > 1
)
UPDATE seller_catalog sc
SET stock = d.total_stock,
    updated_at = now()
FROM duplicados d
WHERE sc.id = d.keep_id;

-- Eliminar registros duplicados (excepto el que mantuvimos)
WITH duplicados AS (
  SELECT 
    source_product_id,
    seller_store_id,
    variant_id,
    array_agg(id ORDER BY created_at DESC) as ids
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY source_product_id, seller_store_id, variant_id
  HAVING COUNT(*) > 1
)
DELETE FROM seller_catalog
WHERE id IN (
  SELECT unnest(ids[2:])
  FROM duplicados
);

SELECT '✅ DUPLICADOS CONSOLIDADOS' as resultado;

-- =============================================================================
-- PASO 4: Crear constraint único DESPUÉS de consolidar
-- =============================================================================
-- Ahora que no hay duplicados, podemos crear el constraint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'seller_catalog_unique_product_variant_store'
  ) THEN
    -- Crear constraint único
    ALTER TABLE seller_catalog
    ADD CONSTRAINT seller_catalog_unique_product_variant_store
    UNIQUE NULLS NOT DISTINCT (seller_store_id, source_product_id, variant_id);
    
    RAISE NOTICE '✅ Constraint creado exitosamente';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint ya existe';
  END IF;
END $$;

-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- Ver productos agrupados correctamente
SELECT 
  '📊 PRODUCTOS AGRUPADOS CORRECTAMENTE' as info,
  p.nombre as producto,
  COUNT(DISTINCT sc.id) as variantes_en_catalogo,
  array_agg(DISTINCT sc.sku) as skus,
  SUM(sc.stock) as stock_total,
  COUNT(DISTINCT sc.variant_id) as variantes_distintas
FROM seller_catalog sc
JOIN products p ON p.id = sc.source_product_id
WHERE sc.source_product_id IS NOT NULL
GROUP BY p.id, p.nombre
ORDER BY COUNT(DISTINCT sc.id) DESC
LIMIT 10;

-- Ver cuántos registros tienen variant_id asignado
SELECT 
  '✅ RESUMEN' as tipo,
  COUNT(*) as total_registros,
  COUNT(variant_id) as con_variant_id,
  COUNT(*) - COUNT(variant_id) as sin_variant_id,
  ROUND(COUNT(variant_id)::numeric / COUNT(*)::numeric * 100, 1) as porcentaje_con_variant
FROM seller_catalog;

-- Ver los registros actualizados (muestra)
SELECT 
  '📦 MUESTRA FINAL' as info,
  sc.id,
  sc.sku,
  sc.nombre,
  sc.source_product_id,
  sc.variant_id,
  CASE 
    WHEN sc.variant_id IS NOT NULL THEN '✅ Con variante'
    ELSE '❌ Sin variante'
  END as estado,
  sc.stock
FROM seller_catalog sc
ORDER BY sc.created_at DESC
LIMIT 10;
