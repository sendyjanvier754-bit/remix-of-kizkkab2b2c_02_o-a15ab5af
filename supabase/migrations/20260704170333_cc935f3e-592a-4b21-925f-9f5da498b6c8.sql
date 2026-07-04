
-- Import batches for 1688 imports with human review of AI translations

CREATE TYPE public.import_batch_status AS ENUM ('draft','in_review','exported','archived');
CREATE TYPE public.import_translation_status AS ENUM ('pending_approval','approved','rejected');
CREATE TYPE public.import_translation_field AS ENUM ('title','description');

-- 1) Batches
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  source_filename text,
  market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.import_batch_status NOT NULL DEFAULT 'draft',
  total_products integer NOT NULL DEFAULT 0,
  created_by uuid,
  exported_by uuid,
  last_exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import batches"
  ON public.import_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Batch products
CREATE TABLE public.import_batch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  source_product_id_1688 text,
  sku text,
  image_url text,
  source_title_zh text,
  source_description_zh text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batch_products_batch ON public.import_batch_products(batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batch_products TO authenticated;
GRANT ALL ON public.import_batch_products TO service_role;
ALTER TABLE public.import_batch_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import batch products"
  ON public.import_batch_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Translations (unit of approval)
CREATE TABLE public.import_batch_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_product_id uuid NOT NULL REFERENCES public.import_batch_products(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  field public.import_translation_field NOT NULL,
  ai_text text,
  edited_text text,
  status public.import_translation_status NOT NULL DEFAULT 'pending_approval',
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_product_id, language_code, field)
);

CREATE INDEX idx_import_batch_translations_product ON public.import_batch_translations(batch_product_id);
CREATE INDEX idx_import_batch_translations_status ON public.import_batch_translations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batch_translations TO authenticated;
GRANT ALL ON public.import_batch_translations TO service_role;
ALTER TABLE public.import_batch_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import batch translations"
  ON public.import_batch_translations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_import_batches_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_import_batches_touch BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.tg_import_batches_touch();
CREATE TRIGGER trg_import_batch_products_touch BEFORE UPDATE ON public.import_batch_products
  FOR EACH ROW EXECUTE FUNCTION public.tg_import_batches_touch();
CREATE TRIGGER trg_import_batch_translations_touch BEFORE UPDATE ON public.import_batch_translations
  FOR EACH ROW EXECUTE FUNCTION public.tg_import_batches_touch();
