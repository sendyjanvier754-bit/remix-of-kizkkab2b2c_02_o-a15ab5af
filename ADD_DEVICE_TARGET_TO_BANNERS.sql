-- ============================================================
-- Migration: Add device_target column to admin_banners
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS device_target TEXT NOT NULL DEFAULT 'all'
  CHECK (device_target IN ('all', 'desktop', 'mobile'));

COMMENT ON COLUMN public.admin_banners.device_target IS
  'Target device for this banner: all (show everywhere), desktop (≥1024px only), mobile (<1024px only)';

-- All existing banners default to "all" — no data loss
