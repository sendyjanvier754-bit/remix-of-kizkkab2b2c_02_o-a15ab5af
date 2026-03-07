-- ============================================================
-- Allow sellers to UPDATE and DELETE their own files in
-- product-images bucket (needed for upsert/overwrite of
-- store logo and banner images stored under store-logos/).
--
-- Without an UPDATE policy, Supabase upsert on an existing
-- file throws an RLS violation on the second upload attempt.
-- ============================================================

-- Seller UPDATE policy
DROP POLICY IF EXISTS "Sellers can update product-images" ON storage.objects;
CREATE POLICY "Sellers can update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sellers WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sellers WHERE user_id = auth.uid())
  )
);

-- Seller DELETE policy (useful for cleanup of old images)
DROP POLICY IF EXISTS "Sellers can delete from product-images" ON storage.objects;
CREATE POLICY "Sellers can delete from product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sellers WHERE user_id = auth.uid())
  )
);

SELECT '✅ Seller UPDATE/DELETE policies added to product-images bucket' AS resultado;
