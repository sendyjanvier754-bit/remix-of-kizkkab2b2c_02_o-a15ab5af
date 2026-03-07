-- ============================================================
-- FIX: RLS Policies for product-images storage bucket
-- Allows admins to upload category images to product-images/categories/
--
-- ROOT CAUSE: No INSERT/UPDATE/DELETE policies exist for admins
-- on the product-images bucket, so uploading category images fails
-- with "new row violates row-level security policy".
--
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── STEP 1: See what policies currently exist ──────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND qual LIKE '%product-images%' OR with_check LIKE '%product-images%'
ORDER BY policyname;


-- ── STEP 2: Add missing admin INSERT policy ─────────────────
-- Allows admins to upload to ANY path inside product-images
-- (covers categories/, products/, banners/, etc.)
DROP POLICY IF EXISTS "Admins can upload to product-images" ON storage.objects;
CREATE POLICY "Admins can upload to product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);


-- ── STEP 3: Add missing admin UPDATE policy ─────────────────
DROP POLICY IF EXISTS "Admins can update product-images" ON storage.objects;
CREATE POLICY "Admins can update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);


-- ── STEP 4: Add missing admin DELETE policy ─────────────────
DROP POLICY IF EXISTS "Admins can delete from product-images" ON storage.objects;
CREATE POLICY "Admins can delete from product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);


-- ── STEP 5: Ensure SELECT policies exist ────────────────────
-- Skip if already present – these are usually created with the bucket.

-- Authenticated read (required for admin/seller views)
DROP POLICY IF EXISTS "Authenticated read product-images" ON storage.objects;
CREATE POLICY "Authenticated read product-images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-images');

-- Public (anon) read – needed because the bucket is public
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'product-images');


-- ── STEP 6: Seller upload policy (if not already present) ───
-- Sellers can upload product/variant images (flat path: {productId}/filename)
-- Only add this if no equivalent policy exists from your initial setup.
DROP POLICY IF EXISTS "Sellers can upload to product-images" ON storage.objects;
CREATE POLICY "Sellers can upload to product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sellers WHERE user_id = auth.uid())
  )
);


-- ── Verify ───────────────────────────────────────────────────
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
