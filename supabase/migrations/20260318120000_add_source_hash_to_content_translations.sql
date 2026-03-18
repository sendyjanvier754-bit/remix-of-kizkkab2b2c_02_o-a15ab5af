-- Track source text version to invalidate stale translations automatically
ALTER TABLE public.content_translations
  ADD COLUMN IF NOT EXISTS source_text TEXT,
  ADD COLUMN IF NOT EXISTS source_text_hash TEXT;

-- Useful for quickly checking freshness by entity/field/lang
CREATE INDEX IF NOT EXISTS idx_content_translations_source_hash
  ON public.content_translations(entity_type, entity_id, field_name, language, source_text_hash);
