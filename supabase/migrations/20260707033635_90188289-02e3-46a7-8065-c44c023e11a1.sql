-- Purge product-level translations that were mistakenly stored from per-variant Excel columns
-- during 1688 imports. The runtime translator will re-translate on demand from the parent
-- product name/description. Only touches rows we auto-imported (is_auto_translated = false)
-- for product name/description entities.
DELETE FROM public.content_translations
WHERE entity_type = 'product'
  AND field_name IN ('name', 'description')
  AND is_auto_translated = false;