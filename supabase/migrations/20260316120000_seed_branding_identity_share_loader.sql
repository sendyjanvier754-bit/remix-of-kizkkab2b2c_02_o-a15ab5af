-- Seed default branding identity/share/loader keys across environments
-- Safe to run multiple times

INSERT INTO public.branding_settings (key, value, description) VALUES
  ('browser_tab_title', '', 'Título por defecto de la pestaña del navegador'),
  ('browser_meta_description', '', 'Descripción por defecto (meta description/tooltip del navegador)'),
  ('share_title', '', 'Título por defecto para compartir enlaces (Open Graph/Twitter)'),
  ('share_description', '', 'Descripción por defecto para compartir enlaces (Open Graph/Twitter)'),
  ('share_image_url', '', 'Imagen por defecto para compartir enlaces (Open Graph/Twitter)'),
  ('loader_media_url', '', 'Media de carga (imagen/gif/video) mostrada en el loader global'),
  ('loader_media_type', 'image', 'Tipo de media de carga: image | gif | video')
ON CONFLICT (key) DO NOTHING;
