
-- Create branding_settings table for platform identity
CREATE TABLE public.branding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read branding (needed for favicon, logo, etc.)
CREATE POLICY "Anyone can read branding" ON public.branding_settings
  FOR SELECT USING (true);

-- Only authenticated admins can update (uses has_role function)
CREATE POLICY "Admins can update branding" ON public.branding_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert branding" ON public.branding_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default values
INSERT INTO public.branding_settings (key, value, description) VALUES
  ('platform_name', 'Siver Market', 'Nombre de la plataforma'),
  ('platform_slogan', 'Tu marketplace B2B2C', 'Slogan de la plataforma'),
  ('logo_url', '', 'URL del logo principal'),
  ('favicon_url', '', 'URL del favicon'),
  ('primary_color', '', 'Color primario de la marca'),
  ('secondary_color', '', 'Color secundario de la marca'),
  ('contact_email', '', 'Email de contacto'),
  ('contact_phone', '', 'Teléfono de contacto'),
  ('social_facebook', '', 'URL Facebook'),
  ('social_instagram', '', 'URL Instagram'),
  ('social_whatsapp', '', 'Número WhatsApp'),
  ('meta_title', '', 'Meta título para SEO'),
  ('meta_description', '', 'Meta descripción para SEO');
