-- =====================================================
-- AGREGAR CATEGORIA_ID A SELLER_CATALOG
-- =====================================================
-- Permite a los sellers cambiar la categoría al publicar
-- sus productos del inventario B2C al marketplace

-- Agregar columna category_id
ALTER TABLE seller_catalog 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_seller_catalog_category 
  ON seller_catalog(category_id) 
  WHERE category_id IS NOT NULL AND is_active = true;

-- Comentario
COMMENT ON COLUMN seller_catalog.category_id IS 
  'Categoría seleccionada por el seller al publicar. Si NULL, hereda de source_product.categoria_id';

-- Migrar categorías existentes desde source_product (opcional)
UPDATE seller_catalog sc
SET category_id = p.categoria_id
FROM products p
WHERE sc.source_product_id = p.id
  AND sc.category_id IS NULL
  AND p.categoria_id IS NOT NULL;

SELECT '✅ Campo category_id agregado a seller_catalog' as resultado;

-- Verificar
SELECT 
  COUNT(*) as total_productos,
  COUNT(category_id) as con_categoria_seleccionada,
  COUNT(*) - COUNT(category_id) as heredan_categoria
FROM seller_catalog
WHERE source_product_id IS NOT NULL;
