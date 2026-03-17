-- Add image position/crop fields to admin_banners
-- Run this in Supabase SQL Editor

ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS mobile_position_x  INTEGER NOT NULL DEFAULT 50 CHECK (mobile_position_x  BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS mobile_position_y  INTEGER NOT NULL DEFAULT 50 CHECK (mobile_position_y  BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS desktop_position_x INTEGER NOT NULL DEFAULT 50 CHECK (desktop_position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS desktop_position_y INTEGER NOT NULL DEFAULT 50 CHECK (desktop_position_y BETWEEN 0 AND 100);
