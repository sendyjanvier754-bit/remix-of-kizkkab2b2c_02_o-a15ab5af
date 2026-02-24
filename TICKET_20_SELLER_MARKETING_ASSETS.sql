-- ============================================================
-- TICKET #20: Historial de Catálogos Generados
-- Fecha: 23-Feb-2026
-- Objetivo: Guardar en BD cada PDF/PNG generado por el seller
--           para poder re-abrirlo luego desde la página Marketing.
-- ============================================================

-- ============================================================
-- PASO 1: Tabla principal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seller_marketing_assets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  store_id      UUID        REFERENCES public.stores(id)        ON DELETE SET NULL,
  type          TEXT        NOT NULL CHECK (type IN ('pdf_catalog', 'png_status')),
  title         TEXT        NOT NULL,
  file_url      TEXT,                    -- URL pública del archivo HTML en Storage
  file_path     TEXT,                    -- Ruta en el bucket (para borrar después)
  product_count INTEGER     NOT NULL DEFAULT 0,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.seller_marketing_assets IS 'Historial de catálogos PDF y PNGs generados por cada seller';
COMMENT ON COLUMN public.seller_marketing_assets.type      IS 'pdf_catalog = catálogo HTML/PDF | png_status = imágenes PNG WhatsApp';
COMMENT ON COLUMN public.seller_marketing_assets.file_url  IS 'URL pública para re-abrir/descargar el archivo';
COMMENT ON COLUMN public.seller_marketing_assets.file_path IS 'Ruta relativa en el bucket marketing-assets (para borrar)';
COMMENT ON COLUMN public.seller_marketing_assets.metadata  IS 'JSON con store_name, products[] etc.';

-- ============================================================
-- PASO 2: Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_marketing_assets_seller
  ON public.seller_marketing_assets (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_assets_store
  ON public.seller_marketing_assets (store_id);

-- ============================================================
-- PASO 3: Row Level Security
-- ============================================================
ALTER TABLE public.seller_marketing_assets ENABLE ROW LEVEL SECURITY;

-- El seller sólo ve y gestiona sus propios assets
CREATE POLICY "marketing_assets_owner_select"
  ON public.seller_marketing_assets FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "marketing_assets_owner_insert"
  ON public.seller_marketing_assets FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "marketing_assets_owner_delete"
  ON public.seller_marketing_assets FOR DELETE
  USING (seller_id = auth.uid());

-- ============================================================
-- PASO 4: Storage bucket  marketing-assets
-- (ejecutar en Supabase Dashboard → Storage → New Bucket,
--  o usando el API de administración)
-- ============================================================

-- En Supabase Dashboard / SQL Editor:
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('marketing-assets', 'marketing-assets', true)
--   ON CONFLICT (id) DO NOTHING;

-- Política de storage (ejecutar en Dashboard → Storage → Policies):
--   Bucket: marketing-assets
--   SELECT: ((storage.foldername(name))[1] = auth.uid()::text)
--   INSERT: ((storage.foldername(name))[1] = auth.uid()::text)
--   DELETE: ((storage.foldername(name))[1] = auth.uid()::text)

-- SQL equivalente para las políticas de storage:
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "marketing_assets_storage_select" ON storage.objects;
CREATE POLICY "marketing_assets_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "marketing_assets_storage_insert" ON storage.objects;
CREATE POLICY "marketing_assets_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'marketing-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "marketing_assets_storage_delete" ON storage.objects;
CREATE POLICY "marketing_assets_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'marketing-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- PASO 5: Validación
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'seller_marketing_assets'
ORDER BY ordinal_position;

-- RESULTADO ESPERADO:
-- id, seller_id, store_id, type, title, file_url, file_path,
-- product_count, metadata, created_at

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'seller_marketing_assets';
-- RESULTADO ESPERADO: 3 políticas RLS (select, insert, delete)
