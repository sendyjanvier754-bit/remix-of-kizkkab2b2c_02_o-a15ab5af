-- =====================================================
-- VERIFICAR PRODUCTOS DUPLICADOS Y LIMPIAR
-- =====================================================

-- 1️⃣ Verificar productos importados duplicados por source_product_id
SELECT 
  source_product_id,
  COUNT(*) as veces_importado,
  STRING_AGG(id::text, ', ') as catalog_ids,
  STRING_AGG(nombre, ' | ') as nombres,
  STRING_AGG(imported_at::text, ', ') as fechas_importacion
FROM seller_catalog
WHERE source_order_id IS NULL
GROUP BY source_product_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2️⃣ Ver detalles de cada producto duplicado
SELECT 
  sc.id as catalog_id,
  sc.nombre,
  sc.source_product_id,
  sc.imported_at,
  COUNT(scv.id) as num_variantes,
  SUM(scv.stock) as stock_total,
  CASE 
    WHEN COUNT(scv.id) = 0 THEN '❌ Sin variantes'
    WHEN SUM(scv.stock) > 0 THEN '✅ Con stock'
    ELSE '⚠️ Sin stock'
  END as estado
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_order_id IS NULL
  AND sc.source_product_id IN (
    SELECT source_product_id 
    FROM seller_catalog 
    WHERE source_order_id IS NULL
    GROUP BY source_product_id 
    HAVING COUNT(*) > 1
  )
GROUP BY sc.id, sc.nombre, sc.source_product_id, sc.imported_at
ORDER BY sc.source_product_id, sc.imported_at DESC;

-- 3️⃣ SOLUCIÓN: Eliminar duplicados, dejando solo el más reciente con variantes
-- (NO EJECUTAR AÚN - Solo para revisar)
WITH duplicados AS (
  SELECT 
    sc.id as catalog_id,
    sc.source_product_id,
    sc.imported_at,
    COUNT(scv.id) as num_variantes,
    SUM(scv.stock) as stock_total,
    ROW_NUMBER() OVER (
      PARTITION BY sc.source_product_id 
      ORDER BY 
        COUNT(scv.id) DESC,  -- Priorizar el que tiene variantes
        SUM(scv.stock) DESC, -- Luego el que tiene stock
        sc.imported_at DESC  -- Finalmente el más reciente
    ) as rn
  FROM seller_catalog sc
  LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
  WHERE sc.source_order_id IS NULL
    AND sc.source_product_id IN (
      SELECT source_product_id 
      FROM seller_catalog 
      WHERE source_order_id IS NULL
      GROUP BY source_product_id 
      HAVING COUNT(*) > 1
    )
  GROUP BY sc.id, sc.source_product_id, sc.imported_at
)
SELECT 
  catalog_id,
  source_product_id,
  num_variantes,
  stock_total,
  CASE 
    WHEN rn = 1 THEN '✅ MANTENER'
    ELSE '❌ ELIMINAR'
  END as accion
FROM duplicados
ORDER BY source_product_id, rn;
