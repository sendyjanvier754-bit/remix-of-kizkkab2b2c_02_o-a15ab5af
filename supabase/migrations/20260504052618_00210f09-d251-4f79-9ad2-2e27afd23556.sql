
-- 1) Payment proofs: make bucket private and lock down policies
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

DROP POLICY IF EXISTS "Public read for payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update their payment proofs" ON storage.objects;

CREATE POLICY "payment_proofs_owner_or_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR owner = auth.uid())
);

CREATE POLICY "payment_proofs_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = 'orders'
);

CREATE POLICY "payment_proofs_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND (public.has_role(auth.uid(), 'admin'::app_role) OR owner = auth.uid()))
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "payment_proofs_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND (public.has_role(auth.uid(), 'admin'::app_role) OR owner = auth.uid()));

-- 2) Partner applications: tighten SELECT
DROP POLICY IF EXISTS "Applicant or admin view application" ON public.partner_applications;
CREATE POLICY "partner_applications_select_own_or_admin"
ON public.partner_applications FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR approved_user_id = auth.uid()
);

-- 3) Product reviews & store reviews: enable RLS + sensible policies
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_reviews_select ON public.product_reviews;
DROP POLICY IF EXISTS product_reviews_insert ON public.product_reviews;
DROP POLICY IF EXISTS product_reviews_update ON public.product_reviews;
DROP POLICY IF EXISTS product_reviews_delete ON public.product_reviews;

CREATE POLICY product_reviews_select ON public.product_reviews
  FOR SELECT USING (is_approved = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY product_reviews_insert ON public.product_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY product_reviews_update ON public.product_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY product_reviews_delete ON public.product_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_reviews_select ON public.store_reviews;
DROP POLICY IF EXISTS store_reviews_insert ON public.store_reviews;
DROP POLICY IF EXISTS store_reviews_update ON public.store_reviews;
DROP POLICY IF EXISTS store_reviews_delete ON public.store_reviews;

CREATE POLICY store_reviews_select ON public.store_reviews
  FOR SELECT USING (true);
CREATE POLICY store_reviews_insert ON public.store_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY store_reviews_update ON public.store_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY store_reviews_delete ON public.store_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Convert all public views to SECURITY INVOKER
ALTER VIEW public.v_business_panel_cart_summary SET (security_invoker = true);
ALTER VIEW public.v_seller_inventory SET (security_invoker = true);
ALTER VIEW public.v_product_max_pvp SET (security_invoker = true);
ALTER VIEW public.user_roles_with_email SET (security_invoker = true);
ALTER VIEW public.v_variantes_con_precio_b2b SET (security_invoker = true);
ALTER VIEW public.v_variantes_precio_simple SET (security_invoker = true);
ALTER VIEW public.v_logistics_data SET (security_invoker = true);
ALTER VIEW public.v_products_without_weight SET (security_invoker = true);
ALTER VIEW public.markets_dashboard SET (security_invoker = true);
ALTER VIEW public.v_refunds_management SET (security_invoker = true);
ALTER VIEW public.v_catalog_products_with_fastest_shipping SET (security_invoker = true);
ALTER VIEW public.v_catalog_product_weight_and_shipping SET (security_invoker = true);
ALTER VIEW public.v_seller_catalog_with_variants SET (security_invoker = true);
ALTER VIEW public.v_productos_con_precio_b2b SET (security_invoker = true);
ALTER VIEW public.v_productos_precio_base SET (security_invoker = true);
ALTER VIEW public.v_business_panel_data SET (security_invoker = true);

-- 5) Set search_path on SECURITY DEFINER functions that lack it
ALTER FUNCTION public.calculate_b2b_price_multitramo(uuid, integer, character varying, uuid) SET search_path = public;
ALTER FUNCTION public.change_refund_status(uuid, refund_status_enum, uuid, text, text, numeric, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.cleanup_deleted_product_images() SET search_path = public;
ALTER FUNCTION public.close_market_po_and_open_next(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_market_po_dashboard() SET search_path = public;
ALTER FUNCTION public.get_or_create_market_po(uuid) SET search_path = public;
ALTER FUNCTION public.get_product_weight(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.log_refund_status_change() SET search_path = public;
ALTER FUNCTION public.update_po_china_tracking(uuid, text) SET search_path = public;
ALTER FUNCTION public.update_po_totals_on_order_change() SET search_path = public;
ALTER FUNCTION public.validate_product_weight(uuid) SET search_path = public;
