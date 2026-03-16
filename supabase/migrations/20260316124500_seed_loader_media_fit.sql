-- Seed loader media fit mode for circular loader rendering
-- Safe to run multiple times

INSERT INTO public.branding_settings (key, value, description) VALUES
  ('loader_media_fit', 'cover', 'Ajuste de media en loader circular: cover | contain')
ON CONFLICT (key) DO NOTHING;
