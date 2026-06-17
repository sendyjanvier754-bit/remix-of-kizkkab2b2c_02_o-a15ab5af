
-- 1) order_deliveries: drop blanket SELECT
DROP POLICY IF EXISTS "order_deliveries_read" ON public.order_deliveries;

-- 2) product_reviews: hide user_email column from public roles
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS reviewer_display text;
UPDATE public.product_reviews
  SET reviewer_display = split_part(user_email, '@', 1)
  WHERE reviewer_display IS NULL AND user_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_product_reviews_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reviewer_display IS NULL AND NEW.user_email IS NOT NULL THEN
    NEW.reviewer_display := split_part(NEW.user_email, '@', 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_reviews_display_name ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_display_name
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_product_reviews_display_name();

REVOKE SELECT (user_email) ON public.product_reviews FROM anon;
REVOKE SELECT (user_email) ON public.product_reviews FROM authenticated;

-- 3) batch_inventory: drop broad read (admin policy already exists)
DROP POLICY IF EXISTS "batch_inventory_read" ON public.batch_inventory;

-- 4) b2b_batches: drop broad read (admin policy already exists)
DROP POLICY IF EXISTS "b2b_batches_read" ON public.b2b_batches;

-- 5) delivery_ratings: scope SELECT
DROP POLICY IF EXISTS "delivery_ratings_read" ON public.delivery_ratings;
CREATE POLICY "delivery_ratings_select_scoped" ON public.delivery_ratings
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR customer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders_b2b ob
      WHERE ob.id = delivery_ratings.order_id
        AND (ob.buyer_id = auth.uid() OR ob.seller_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders_b2c oc
      JOIN public.stores s ON s.id = oc.store_id
      WHERE oc.id = delivery_ratings.order_id
        AND (oc.buyer_user_id = auth.uid() OR s.owner_user_id = auth.uid())
    )
  );

-- 6) shipment_tracking: scope SELECT
DROP POLICY IF EXISTS "shipment_tracking_read" ON public.shipment_tracking;
CREATE POLICY "shipment_tracking_select_scoped" ON public.shipment_tracking
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders_b2b ob
      WHERE ob.id = shipment_tracking.order_id
        AND (ob.buyer_id = auth.uid() OR ob.seller_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders_b2c oc
      JOIN public.stores s ON s.id = oc.store_id
      WHERE oc.id = shipment_tracking.order_id
        AND (oc.buyer_user_id = auth.uid() OR s.owner_user_id = auth.uid())
    )
  );
