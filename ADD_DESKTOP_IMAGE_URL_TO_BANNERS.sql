-- ============================================================
-- Migration: Add desktop_image_url column to admin_banners
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS desktop_image_url TEXT;

COMMENT ON COLUMN public.admin_banners.desktop_image_url IS
  'Optional landscape image for desktop (≥1024px). If NULL, image_url is used on all devices.';
