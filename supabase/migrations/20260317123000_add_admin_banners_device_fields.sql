-- Add device-specific media/crop/zoom fields for admin banners

ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS desktop_image_url TEXT,
  ADD COLUMN IF NOT EXISTS device_target TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS mobile_position_x  INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mobile_position_y  INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mobile_scale       INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS desktop_position_x INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS desktop_position_y INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS desktop_scale      INTEGER NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_device_target_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_device_target_check
      CHECK (device_target IN ('all', 'desktop', 'mobile'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_mobile_position_x_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_mobile_position_x_check
      CHECK (mobile_position_x BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_mobile_position_y_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_mobile_position_y_check
      CHECK (mobile_position_y BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_desktop_position_x_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_desktop_position_x_check
      CHECK (desktop_position_x BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_desktop_position_y_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_desktop_position_y_check
      CHECK (desktop_position_y BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_mobile_scale_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_mobile_scale_check
      CHECK (mobile_scale BETWEEN 50 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_banners_desktop_scale_check'
      AND conrelid = 'public.admin_banners'::regclass
  ) THEN
    ALTER TABLE public.admin_banners
      ADD CONSTRAINT admin_banners_desktop_scale_check
      CHECK (desktop_scale BETWEEN 50 AND 200);
  END IF;
END $$;

COMMENT ON COLUMN public.admin_banners.desktop_image_url IS
  'Optional image for desktop (>=1024px). If NULL, image_url is used.';
COMMENT ON COLUMN public.admin_banners.device_target IS
  'Target device: all, desktop, mobile (tablet uses mobile group in UI).';
