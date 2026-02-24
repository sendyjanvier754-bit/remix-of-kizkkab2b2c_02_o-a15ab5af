-- =============================================================================
-- MIGRACIÓN: Separar user_favorites en b2b_favorites y b2c_favorites
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CREAR TABLA b2b_favorites
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.b2b_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CREAR TABLA b2c_favorites
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.b2c_favorites (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id        uuid REFERENCES public.products(id) ON DELETE CASCADE,
  seller_catalog_id uuid REFERENCES public.seller_catalog(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_b2c_has_reference
    CHECK (product_id IS NOT NULL OR seller_catalog_id IS NOT NULL),
  UNIQUE (user_id, product_id),
  UNIQUE (user_id, seller_catalog_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_b2b_favorites_user  ON public.b2b_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_favorites_prod  ON public.b2b_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_b2c_favorites_user  ON public.b2c_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_b2c_favorites_prod  ON public.b2c_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_b2c_favorites_cat   ON public.b2c_favorites(seller_catalog_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.b2b_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2c_favorites ENABLE ROW LEVEL SECURITY;

-- B2B
CREATE POLICY "b2b_favorites_select" ON public.b2b_favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "b2b_favorites_insert" ON public.b2b_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "b2b_favorites_delete" ON public.b2b_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- B2C
CREATE POLICY "b2c_favorites_select" ON public.b2c_favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "b2c_favorites_insert" ON public.b2c_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "b2c_favorites_delete" ON public.b2c_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MIGRAR datos existentes de user_favorites
-- ─────────────────────────────────────────────────────────────────────────────

-- B2B: los que tienen type='B2B' y product_id válido
INSERT INTO public.b2b_favorites (user_id, product_id, created_at)
SELECT user_id, product_id, created_at
FROM public.user_favorites
WHERE type = 'B2B'
  AND product_id IS NOT NULL
ON CONFLICT (user_id, product_id) DO NOTHING;

-- B2C: los que tienen type='B2C' o sin tipo, con product_id o seller_catalog_id
INSERT INTO public.b2c_favorites (user_id, product_id, seller_catalog_id, created_at)
SELECT
  user_id,
  product_id,
  seller_catalog_id,
  created_at
FROM public.user_favorites
WHERE (type = 'B2C' OR type IS NULL)
  AND (product_id IS NOT NULL OR seller_catalog_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERIFICACIÓN — ejecutar primero
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'b2b_favorites'  AS tabla, COUNT(*) AS total FROM public.b2b_favorites
UNION ALL
SELECT 'b2c_favorites'  AS tabla, COUNT(*) AS total FROM public.b2c_favorites
UNION ALL
SELECT 'user_favorites' AS tabla, COUNT(*) AS total FROM public.user_favorites;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ELIMINAR TABLA ANTIGUA — ejecutar SOLO después de verificar que la app
--    funciona correctamente con las nuevas tablas.
--    Descomenta las líneas cuando estés listo.
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.user_favorites CASCADE;
