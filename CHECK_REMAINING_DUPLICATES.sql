-- =====================================================
-- VERIFICAR SI HAY DUPLICADOS REALES
-- =====================================================
-- Este script verifica si los registros "duplicados" que vemos
-- realmente tienen el mismo seller_store_id (problema real)
-- o tienen diferentes seller_store_id (comportamiento correcto)
-- =====================================================

-- =============================================================================
-- 1. Ver todos los registros de "Camiseta Premium" con seller_store_id
-- =============================================================================

SELECT 
  '🔍 CAMISETA PREMIUM - Análisis completo' as info,
  sc.id,
  sc.seller_store_id,
  sc.sku,
  sc.nombre,
  sc.source_product_id,
  sc.variant_id,
  CASE 
    WHEN sc.variant_id IS NOT NULL THEN '✅ Con variante'
    ELSE '❌ Sin variante'
  END as estado,
  sc.stock,
  sc.created_at
FROM seller_catalog sc
WHERE sc.nombre LIKE '%Camiseta Premium%'
ORDER BY sc.source_product_id, sc.seller_store_id, sc.created_at;

-- =============================================================================
-- 2. Buscar DUPLICADOS REALES (mismo seller_store_id + product + variant)
-- =============================================================================

WITH duplicados_reales AS (
  SELECT 
    seller_store_id,
    source_product_id,
    variant_id,
    COUNT(*) as total_duplicados,
    array_agg(id ORDER BY created_at DESC) as ids,
    array_agg(sku ORDER BY created_at DESC) as skus,
    array_agg(stock ORDER BY created_at DESC) as stocks,
    array_agg(nombre ORDER BY created_at DESC) as nombres
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY seller_store_id, source_product_id, variant_id
  HAVING COUNT(*) > 1
)
SELECT 
  '⚠️ DUPLICADOS REALES (mismo vendedor)' as alerta,
  dr.seller_store_id,
  dr.source_product_id,
  dr.variant_id,
  dr.total_duplicados as cantidad,
  dr.skus,
  dr.stocks,
  dr.nombres[1] as producto
FROM duplicados_reales dr;

-- =============================================================================
-- 3. Ver si el constraint único fue creado
-- =============================================================================

SELECT 
  '🔐 CONSTRAINT ÚNICO' as info,
  conname as nombre_constraint,
  contype as tipo,
  CASE contype
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    ELSE contype
  END as tipo_descripcion
FROM pg_constraint
WHERE conrelid = 'seller_catalog'::regclass
  AND conname LIKE '%variant%';

-- =============================================================================
-- 4. Contar registros con y sin variant_id
-- =============================================================================

SELECT 
  '📊 RESUMEN GENERAL' as info,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN variant_id IS NOT NULL THEN 1 END) as con_variant_id,
  COUNT(CASE WHEN variant_id IS NULL THEN 1 END) as sin_variant_id,
  ROUND(
    100.0 * COUNT(CASE WHEN variant_id IS NOT NULL THEN 1 END) / COUNT(*),
    2
  ) as porcentaje_con_variant
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- =============================================================================
-- 5. Ver distribución por vendedor
-- =============================================================================

SELECT 
  '👥 PRODUCTOS POR VENDEDOR' as info,
  seller_store_id,
  COUNT(*) as total_productos,
  COUNT(DISTINCT source_product_id) as productos_unicos,
  COUNT(CASE WHEN variant_id IS NOT NULL THEN 1 END) as con_variantes
FROM seller_catalog
WHERE source_product_id IS NOT NULL
GROUP BY seller_store_id
ORDER BY total_productos DESC;
