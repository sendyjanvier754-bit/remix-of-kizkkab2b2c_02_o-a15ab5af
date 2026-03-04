-- ============================================================
-- MIGRATION: Payment Proof (Comprobante de Pago) Storage Bucket
-- Run this in your Supabase SQL Editor (or via CLI migration)
-- ============================================================

-- 1. Create the storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,                           -- public so the URL can be shown in both admin/seller views
  8388608,                        -- 8 MB max per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- 2. RLS policies for the storage bucket

-- Sellers can upload their own order proofs
CREATE POLICY "Sellers can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = 'orders'
);

-- Sellers can update (replace) their own proof
CREATE POLICY "Sellers can update their payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

-- Anyone authenticated can read (needed for admin viewing)
CREATE POLICY "Authenticated users can read payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');

-- Public read since bucket is public (for generated public URLs)
CREATE POLICY "Public read for payment proofs"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'payment-proofs');


-- 3. (Optional) Add a dedicated column to orders_b2b for quick querying.
--    The frontend stores the URL in metadata.payment_proof_url, so this is
--    only needed if you want to query/filter by proof status at the DB level.
--
-- ALTER TABLE orders_b2b ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
