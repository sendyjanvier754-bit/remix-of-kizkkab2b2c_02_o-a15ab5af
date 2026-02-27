-- =====================================================
-- CONSULTAR ESTRUCTURA DE TABLAS
-- =====================================================
-- Ver las columnas exactas de las tablas que usaremos
-- =====================================================

-- =============================================================================
-- 1. Tabla: products
-- =============================================================================

SELECT 
  '🔍 TABLA: products' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- =============================================================================
-- 2. Tabla: seller_catalog
-- =============================================================================

SELECT 
  '🔍 TABLA: seller_catalog' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog'
ORDER BY ordinal_position;

-- =============================================================================
-- 3. Tabla: product_variants
-- =============================================================================

SELECT 
  '🔍 TABLA: product_variants' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_variants'
ORDER BY ordinal_position;

-- =============================================================================
-- 4. Tabla: order_items_b2b
-- =============================================================================

SELECT 
  '🔍 TABLA: order_items_b2b' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;

-- =============================================================================
-- 5. Ver datos de ejemplo de products
-- =============================================================================

SELECT 
  '📦 MUESTRA: products (primeros 3)' as info,
  id,
  nombre,
  descripcion_corta,
  descripcion_larga,
  imagen_principal,
  galeria_imagenes
FROM products
WHERE is_active = true
LIMIT 3;

-- =============================================================================
-- 6. Ver datos de ejemplo de seller_catalog
-- =============================================================================

SELECT 
  '📦 MUESTRA: seller_catalog (primeros 3)' as info,
  id,
  seller_store_id,
  source_product_id,
  sku,
  nombre,
  descripcion,
  images
FROM seller_catalog
WHERE source_product_id IS NOT NULL
LIMIT 3;
