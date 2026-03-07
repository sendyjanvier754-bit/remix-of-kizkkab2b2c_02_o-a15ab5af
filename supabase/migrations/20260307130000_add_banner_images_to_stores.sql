-- ============================================================
-- Add banner_images column to stores table.
-- Sellers can now store an ordered array of banner image URLs
-- for display as an auto-cycling carousel on the store page.
-- The legacy `banner` column is kept for backward compatibility.
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS banner_images text[] DEFAULT '{}'::text[];

SELECT '✅ banner_images column added to stores table' AS resultado;
