-- Migración: Agregar columna default_markup_multiplier a categories
-- Fecha: 2026-02-04
-- Propósito: Permitir configurar margen de markup por categoría para calcular PVP sugerido
-- Autor: Sistema
-- Fase: FASE 1 - Tarea 1.1

-- =====================================================
-- 1. AGREGAR COLUMNA default_markup_multiplier
-- =====================================================

-- Agregar columna si no existe
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS default_markup_multiplier NUMERIC DEFAULT 4.0;

-- Agregar comentario descriptivo
COMMENT ON COLUMN categories.default_markup_multiplier IS 
  'Multiplicador para calcular PVP sugerido. Ejemplo: 4.0 = 400% markup (precio_b2b × 4)';

-- =====================================================
-- 2. VALIDACIÓN DE DATOS
-- =====================================================

-- Asegurar que valores existentes nulos se establezcan al default
UPDATE categories 
SET default_markup_multiplier = 4.0 
WHERE default_markup_multiplier IS NULL;

-- Agregar constraint para valores válidos (entre 1.0 y 10.0)
ALTER TABLE categories
ADD CONSTRAINT check_markup_multiplier_range 
CHECK (default_markup_multiplier >= 1.0 AND default_markup_multiplier <= 10.0);

-- =====================================================
-- 3. ÍNDICE PARA PERFORMANCE (opcional)
-- =====================================================

-- Crear índice si se consulta frecuentemente
CREATE INDEX IF NOT EXISTS idx_categories_markup 
ON categories(default_markup_multiplier);

-- =====================================================
-- 4. DATOS INICIALES SUGERIDOS POR CATEGORÍA
-- =====================================================

-- Actualizar markups específicos por tipo de categoría
-- (Ajustar según necesidad del negocio)

-- Ejemplo: Electrónica (margen más bajo por competencia)
UPDATE categories 
SET default_markup_multiplier = 3.5 
WHERE LOWER(name) LIKE '%electr%' 
  OR LOWER(name) LIKE '%tecno%';

-- Ejemplo: Ropa y accesorios (margen más alto)
UPDATE categories 
SET default_markup_multiplier = 4.5 
WHERE LOWER(name) LIKE '%ropa%' 
  OR LOWER(name) LIKE '%accesorio%'
  OR LOWER(name) LIKE '%moda%';

-- Ejemplo: Alimentos (margen moderado)
UPDATE categories 
SET default_markup_multiplier = 3.0 
WHERE LOWER(name) LIKE '%alimento%' 
  OR LOWER(name) LIKE '%comida%'
  OR LOWER(name) LIKE '%bebida%';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Query de verificación (comentada para no ejecutar automáticamente)
-- SELECT 
--   id,
--   name,
--   default_markup_multiplier,
--   CASE 
--     WHEN default_markup_multiplier < 3.0 THEN 'Margen Bajo'
--     WHEN default_markup_multiplier < 4.5 THEN 'Margen Medio'
--     ELSE 'Margen Alto'
--   END as tipo_margen
-- FROM categories
-- ORDER BY default_markup_multiplier DESC;

-- =====================================================
-- ROLLBACK (si es necesario)
-- =====================================================

-- Para revertir esta migración, ejecutar:
-- ALTER TABLE categories DROP COLUMN IF EXISTS default_markup_multiplier;
-- DROP INDEX IF EXISTS idx_categories_markup;
