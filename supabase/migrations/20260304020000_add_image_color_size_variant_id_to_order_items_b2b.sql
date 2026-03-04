-- =====================================================
-- ADD image to order_items_b2b
-- =====================================================
-- variant_id, color, size, variant_attributes, metadata, precio_total
-- already exist per DATABASE_SCHEMA_MIGRATION.sql.
-- Only "image" (TEXT) is missing.

ALTER TABLE public.order_items_b2b
  ADD COLUMN IF NOT EXISTS image TEXT;
