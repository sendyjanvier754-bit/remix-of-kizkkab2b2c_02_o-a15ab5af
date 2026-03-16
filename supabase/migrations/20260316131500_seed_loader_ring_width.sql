-- Seed loader ring border thickness setting
-- Safe to run multiple times

INSERT INTO public.branding_settings (key, value, description) VALUES
  ('loader_ring_width', '4', 'Grosor (px) del borde del círculo giratorio del loader')
ON CONFLICT (key) DO NOTHING;
