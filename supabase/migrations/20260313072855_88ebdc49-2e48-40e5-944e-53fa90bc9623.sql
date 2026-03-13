
-- ============================================================
-- FIX: order_items_b2c RLS policies
-- Table had RLS enabled but NO policies → all inserts blocked
-- ============================================================

-- INSERT: authenticated user can insert items that belong to their own order
CREATE POLICY "Users can insert items for their own b2c orders"
ON public.order_items_b2c
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders_b2c
    WHERE id = order_id
      AND buyer_user_id = auth.uid()
  )
);

-- SELECT: buyer can view their own order items
CREATE POLICY "Users can view items of their own b2c orders"
ON public.order_items_b2c
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2c
    WHERE id = order_id
      AND buyer_user_id = auth.uid()
  )
);

-- SELECT (admin): admins can view all order items
CREATE POLICY "Admins can view all b2c order items"
ON public.order_items_b2c
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);
