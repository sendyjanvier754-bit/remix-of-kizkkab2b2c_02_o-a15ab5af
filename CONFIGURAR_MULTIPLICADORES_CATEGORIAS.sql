-- =============================================================================
-- CONFIGURAR MULTIPLICADORES POR CATEGORÍA DESDE EL ADMIN
-- Fecha: 2026-02-12
-- Propósito: Permitir que el admin configure el multiplicador por categoría
-- =============================================================================

-- =============================================================================
-- 1. VERIFICAR Y CONFIGURAR COLUMNA EN categories
-- =============================================================================

-- Verificar si la columna existe
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'categories'
  AND column_name = 'default_markup_multiplier';

-- Asegurar que nuevas categorías tengan DEFAULT = 4.0
DO $$
BEGIN
  -- Modificar el DEFAULT si la columna existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'categories' 
      AND column_name = 'default_markup_multiplier'
  ) THEN
    ALTER TABLE categories 
    ALTER COLUMN default_markup_multiplier SET DEFAULT 4.0;
    
    RAISE NOTICE 'DEFAULT configurado a 4.0 para nuevas categorías';
  END IF;
END $$;

-- Crear índice para optimizar búsquedas (si tiene muchas categorías)
CREATE INDEX IF NOT EXISTS idx_categories_markup 
ON categories(default_markup_multiplier) 
WHERE default_markup_multiplier IS NOT NULL;

-- =============================================================================
-- 2. ESTABLECER MULTIPLICADORES POR DEFECTO PARA CATEGORÍAS EXISTENTES
-- =============================================================================

-- Optimizado: Actualizar en lotes por tipo de categoría (más rápido que CASE múltiple)

-- Electrónica: menor margen (alta competencia)
UPDATE categories
SET default_markup_multiplier = 3.0
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%electr%' OR name ILIKE '%phone%' OR name ILIKE '%computer%' OR name ILIKE '%tablet%');

-- Ropa y moda: margen medio-alto
UPDATE categories
SET default_markup_multiplier = 4.5
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%ropa%' OR name ILIKE '%cloth%' OR name ILIKE '%fashion%' OR name ILIKE '%vestir%');

-- Joyería y accesorios: margen alto
UPDATE categories
SET default_markup_multiplier = 5.0
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%joya%' OR name ILIKE '%jewelry%' OR name ILIKE '%accesori%' OR name ILIKE '%reloj%' OR name ILIKE '%watch%');

-- Juguetes: margen alto
UPDATE categories
SET default_markup_multiplier = 4.0
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%juguet%' OR name ILIKE '%toy%' OR name ILIKE '%niño%' OR name ILIKE '%kid%');

-- Hogar y decoración: margen medio
UPDATE categories
SET default_markup_multiplier = 3.5
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%hogar%' OR name ILIKE '%home%' OR name ILIKE '%decor%' OR name ILIKE '%casa%');

-- Bebés: margen medio-alto
UPDATE categories
SET default_markup_multiplier = 4.0
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%beb%' OR name ILIKE '%baby%' OR name ILIKE '%infant%');

-- Deportes: margen medio
UPDATE categories
SET default_markup_multiplier = 3.5
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%deport%' OR name ILIKE '%sport%' OR name ILIKE '%fitness%');

-- Belleza y cuidado personal: margen alto
UPDATE categories
SET default_markup_multiplier = 4.5
WHERE (default_markup_multiplier IS NULL OR default_markup_multiplier = 0)
  AND (name ILIKE '%belle%' OR name ILIKE '%beauty%' OR name ILIKE '%cosmet%' OR name ILIKE '%maquilla%');

-- Resto: multiplicador por defecto 4x (300% margen)
UPDATE categories
SET default_markup_multiplier = 4.0
WHERE default_markup_multiplier IS NULL OR default_markup_multiplier = 0;

-- =============================================================================
-- 3. VERIFICAR RESULTADOS
-- =============================================================================

SELECT 
  name as categoria,
  default_markup_multiplier as multiplicador,
  COUNT(p.id) as total_productos,
  ROUND(AVG(vb2b.precio_b2b), 2) as avg_precio_b2b,
  ROUND(AVG(vb2b.precio_b2b * COALESCE(c.default_markup_multiplier, 4.0)), 2) as avg_pvp_sugerido
FROM categories c
LEFT JOIN products p ON p.categoria_id = c.id AND p.is_active = TRUE
LEFT JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
GROUP BY c.id, c.name, c.default_markup_multiplier
ORDER BY c.name;

-- =============================================================================
-- 4. EJEMPLOS DE ACTUALIZACIÓN MANUAL (Para el Admin Panel)
-- =============================================================================

-- Ejemplo 1: Cambiar multiplicador de una categoría específica
-- UPDATE categories 
-- SET default_markup_multiplier = 5.0
-- WHERE name = 'Electrónica';

-- Ejemplo 2: Cambiar múltiples categorías
-- UPDATE categories 
-- SET default_markup_multiplier = 3.5
-- WHERE name IN ('Hogar', 'Deportes', 'Automotriz');

-- Ejemplo 3: Resetear una categoría al valor por defecto
-- UPDATE categories 
-- SET default_markup_multiplier = 4.0
-- WHERE name = 'Otros';

-- =============================================================================
-- 5. QUERY PARA EL ADMIN PANEL (Frontend)
-- =============================================================================

/*
Para mostrar en el Admin Panel:

SELECT 
  id,
  name as categoria_nombre,
  default_markup_multiplier as multiplicador,
  (SELECT COUNT(*) FROM products WHERE categoria_id = c.id AND is_active = TRUE) as total_productos,
  created_at,
  updated_at
FROM categories c
ORDER BY name;

Para actualizar desde el Admin Panel:

UPDATE categories
SET 
  default_markup_multiplier = :nuevo_multiplicador,
  updated_at = NOW()
WHERE id = :categoria_id;
*/

-- =============================================================================
-- RESULTADO ESPERADO:
-- - Todas las categorías deben tener un default_markup_multiplier configurado
-- - Los valores varían según el tipo de producto (3.0 a 5.0)
-- - El admin puede actualizarlos desde el panel
-- - Índices creados para optimización con muchos productos
-- =============================================================================

SELECT 
  COUNT(*) as total_categorias,
  COUNT(CASE WHEN default_markup_multiplier IS NOT NULL THEN 1 END) as con_multiplicador,
  ROUND(AVG(default_markup_multiplier), 2) as avg_multiplicador,
  MIN(default_markup_multiplier) as min_multiplicador,
  MAX(default_markup_multiplier) as max_multiplicador
FROM categories;

-- =============================================================================
-- 6. OPTIMIZACIÓN: Índices para muchos productos
-- =============================================================================

-- Índice en products.categoria_id (optimiza JOIN con categories)
CREATE INDEX IF NOT EXISTS idx_products_categoria 
ON products(categoria_id) 
WHERE is_active = TRUE;

-- Índice compuesto para búsquedas de precio B2B por categoría
CREATE INDEX IF NOT EXISTS idx_products_categoria_active 
ON products(categoria_id, is_active) 
INCLUDE (id, sku_interno, nombre);

-- Verificar índices creados
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('categories', 'products')
  AND schemaname = 'public'
  AND (indexname LIKE '%categoria%' OR indexname LIKE '%markup%')
ORDER BY tablename, indexname;
