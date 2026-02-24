-- =============================================================================
-- FIX: user_favorites — agregar columna variant_id faltante
--
-- PROBLEMA:
--   El hook useWishlist.ts intenta insertar variant_id en user_favorites
--   pero la columna no existe → Error 400 "Could not find the variant_id column"
--
-- SOLUCIÓN:
--   Agregar variant_id con FK a product_variants
--
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.user_favorites
  ADD COLUMN IF NOT EXISTS variant_id uuid
    REFERENCES public.product_variants(id)
    ON DELETE CASCADE;

-- Índice para búsquedas por variant_id
CREATE INDEX IF NOT EXISTS idx_user_favorites_variant_id
  ON public.user_favorites(variant_id)
  WHERE variant_id IS NOT NULL;

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'user_favorites'
ORDER BY ordinal_position;
