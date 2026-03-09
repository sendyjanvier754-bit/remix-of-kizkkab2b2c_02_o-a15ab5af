-- MIGRATION: Branding Assets Storage Bucket + Legal Content + Payment Icon Keys
-- Run this in the Supabase SQL Editor or via the Supabase CLI.

-- 1. Create the public branding-assets storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-assets',
  'branding-assets',
  true,
  5242880,          -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies
-- Only admins can upload/delete; everyone can read (bucket is public)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admin can upload branding assets'
  ) THEN
    CREATE POLICY "Admin can upload branding assets"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'branding-assets'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admin can update branding assets'
  ) THEN
    CREATE POLICY "Admin can update branding assets"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'branding-assets'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admin can delete branding assets'
  ) THEN
    CREATE POLICY "Admin can delete branding assets"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'branding-assets'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public can read branding assets'
  ) THEN
    CREATE POLICY "Public can read branding assets"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'branding-assets');
  END IF;
END$$;

-- 3. Insert new branding_settings keys (no-op if already present)
INSERT INTO public.branding_settings (key, value, description) VALUES
  ('payment_icon_visa',        '/visa.png',             'Icono de VISA (URL o ruta)'),
  ('payment_icon_mastercard',  '/mastercard.png',       'Icono de Mastercard'),
  ('payment_icon_amex',        '/american express.png', 'Icono de American Express'),
  ('payment_icon_applepay',    '/apple pay.png',        'Icono de Apple Pay'),
  ('payment_icon_googlepay',   '/google pay.png',       'Icono de Google Pay'),
  ('payment_icon_moncash',     '',                      'Icono de MonCash (vacío = badge por defecto)'),
  ('payment_icon_natcash',     '',                      'Icono de NatCash (vacío = badge por defecto)'),
  ('payment_icon_transfer',    '',                      'Icono de Transferencia Bancaria (vacío = badge por defecto)'),
  ('legal_terms',              '',                      'HTML personalizado para Términos y Condiciones (vacío = texto por defecto del sistema)'),
  ('legal_privacy',            '',                      'HTML personalizado para Política de Privacidad (vacío = texto por defecto)'),
  ('legal_cookies',            '',                      'HTML personalizado para Política de Cookies (vacío = texto por defecto)'),
  ('about_content',            '',                      'HTML personalizado para la página Sobre Nosotros (vacío = texto por defecto)'),
  ('affiliate_program',        '',                      'HTML personalizado para los Términos del Programa de Afiliados (vacío = texto por defecto)'),
  ('trust_badge_1_title',      'Envío desde el extranjero',      'Título del 1er banner de confianza en el footer'),
  ('trust_badge_1_desc',       'Recibe tus productos en 7-15 días', 'Descripción del 1er banner de confianza'),
  ('trust_badge_2_title',      'Devolución Gratis',              'Título del 2do banner de confianza en el footer'),
  ('trust_badge_2_desc',       'Devuelve fácilmente en 30 días', 'Descripción del 2do banner de confianza'),
  ('trust_badge_3_title',      'Pago Seguro',                    'Título del 3er banner de confianza en el footer'),
  ('trust_badge_3_desc',       'Múltiples opciones de pago',     'Descripción del 3er banner de confianza')
ON CONFLICT (key) DO NOTHING;
