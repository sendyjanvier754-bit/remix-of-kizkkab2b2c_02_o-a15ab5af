-- ============================================================
-- Add banner_slide_interval column to stores table.
-- Sellers can configure how many seconds each banner is shown
-- before sliding to the next one. Default is 3 seconds.
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS banner_slide_interval integer DEFAULT 3;

SELECT '✅ banner_slide_interval column added to stores table' AS resultado;
