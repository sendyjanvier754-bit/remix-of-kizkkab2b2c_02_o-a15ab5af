-- ============================================
-- FASE 1.1: Agregar markup a categories
-- Fecha: 2026-02-05
-- Objetivo: Agregar columna para multiplicador de PVP por categoría
-- ============================================

-- Agregar columna default_markup_multiplier
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS default_markup_multiplier NUMERIC DEFAULT 4.0;

-- Agregar comentario explicativo
COMMENT ON COLUMN public.categories.default_markup_multiplier IS 
'Multiplicador para calcular PVP sugerido. Default 4.0 = 400% (seller compra a $10, vende a $40). Puede ajustarse por categoría.';

-- Agregar índice para mejorar performance en queries
CREATE INDEX IF NOT EXISTS idx_categories_markup 
ON public.categories(default_markup_multiplier) 
WHERE default_markup_multiplier IS NOT NULL;

-- Actualizar categorías existentes con valores específicos (opcional)
-- Ejemplo: Categorías de lujo pueden tener markup mayor
UPDATE public.categories 
SET default_markup_multiplier = 5.0 
WHERE name ILIKE '%premium%' OR name ILIKE '%lujo%';

-- Ejemplo: Categorías de alta rotación pueden tener markup menor
UPDATE public.categories 
SET default_markup_multiplier = 3.0 
WHERE name ILIKE '%básico%' OR name ILIKE '%esencial%';

-- Verificación
SELECT 
  id,
  name,
  default_markup_multiplier,
  CASE 
    WHEN default_markup_multiplier >= 5.0 THEN '🔷 Premium'
    WHEN default_markup_multiplier >= 4.0 THEN '📦 Estándar'
    ELSE '⚡ Alta Rotación'
  END as categoria_markup
FROM public.categories
ORDER BY default_markup_multiplier DESC;
