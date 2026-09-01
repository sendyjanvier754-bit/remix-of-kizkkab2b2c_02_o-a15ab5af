ALTER TABLE public.pickup_points ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "Anyone can upload partner logos"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'partner-logos');

CREATE POLICY "Admins manage partner logos update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'partner-logos')
WITH CHECK (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'partner-logos');