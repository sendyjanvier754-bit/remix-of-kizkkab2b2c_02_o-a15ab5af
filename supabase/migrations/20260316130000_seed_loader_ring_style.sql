-- Seed loader ring style settings (color + size)
-- Safe to run multiple times

INSERT INTO public.branding_settings (key, value, description) VALUES
  ('loader_ring_color', '#1d4ed8', 'Color del círculo giratorio del loader'),
  ('loader_ring_size', '96', 'Tamaño (px) del círculo giratorio del loader')
ON CONFLICT (key) DO NOTHING;
