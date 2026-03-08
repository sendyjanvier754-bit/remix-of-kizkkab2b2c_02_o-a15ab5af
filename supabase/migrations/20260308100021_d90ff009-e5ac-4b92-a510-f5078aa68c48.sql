-- Fix: Replace public SELECT policy on order_deliveries with auth-scoped policy
CREATE POLICY "Parties can view their delivery" ON public.order_deliveries
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders_b2b ob
      WHERE ob.id = order_deliveries.order_id
        AND (ob.buyer_id = auth.uid() OR ob.seller_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders_b2c oc
      JOIN public.stores s ON s.id = oc.store_id
      WHERE oc.id = order_deliveries.order_id
        AND (oc.buyer_user_id = auth.uid() OR s.owner_user_id = auth.uid())
    )
  );
