-- Add zoom/scale fields to admin_banners
-- Run this in Supabase SQL Editor

ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS mobile_scale  INTEGER NOT NULL DEFAULT 100 CHECK (mobile_scale  BETWEEN 50 AND 200),
  ADD COLUMN IF NOT EXISTS desktop_scale INTEGER NOT NULL DEFAULT 100 CHECK (desktop_scale BETWEEN 50 AND 200);
