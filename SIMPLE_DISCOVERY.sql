-- ============================================================================
-- DESCUBRIMIENTO SIMPLE: Encontrar el nombre real de la columna de peso
-- ============================================================================

-- 1. TODAS LAS COLUMNAS DE LA TABLA PRODUCTS
-- ============================================================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'products'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. TODAS LAS COLUMNAS DE LA TABLA PRODUCT_VARIANTS
-- ============================================================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'product_variants'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. BUSCAR CUALQUIER COLUMNA QUE CONTENGA "PESO", "WEIGHT", "KG", "G"
-- ============================================================================
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND (column_name LIKE '%peso%' 
  OR column_name LIKE '%weight%'
  OR column_name LIKE '%kg%'
  OR column_name LIKE '%gram%'
  OR column_name LIKE '%dimension%')
ORDER BY table_name, column_name;

-- 4. VER TODAS LAS VISTAS (PARA VER v_productos_con_precio_b2b Y v_variantes_con_precio_b2b)
-- ============================================================================
SELECT 
  schemaname,
  viewname
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 5. MUESTRA DE DATOS DE PRODUCTS (PRIMERAS 3 FILAS CON TODOS LOS CAMPOS)
-- ============================================================================
SELECT *
FROM products
LIMIT 3;

-- 6. MUESTRA DE DATOS DE PRODUCT_VARIANTS (PRIMERAS 3 FILAS CON TODOS LOS CAMPOS)
-- ============================================================================
SELECT *
FROM product_variants
LIMIT 3;
