
-- Tabla centralizada de traducciones de contenido de DB
CREATE TABLE public.content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,       -- 'category', 'product', 'variant', 'notification'
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,        -- 'name', 'description', 'nombre', etc.
  language TEXT NOT NULL,          -- 'en', 'fr', 'ht', 'es'
  translated_text TEXT NOT NULL,
  is_auto_translated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id, field_name, language)
);

-- Index for fast lookups
CREATE INDEX idx_content_translations_lookup 
  ON public.content_translations(entity_type, entity_id, language);

CREATE INDEX idx_content_translations_entity
  ON public.content_translations(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

-- Everyone can read translations
CREATE POLICY "Anyone can read translations"
  ON public.content_translations FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can manage translations
CREATE POLICY "Admins can manage translations"
  ON public.content_translations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow edge functions (service role) to insert/update translations
-- This is handled by service_role which bypasses RLS
