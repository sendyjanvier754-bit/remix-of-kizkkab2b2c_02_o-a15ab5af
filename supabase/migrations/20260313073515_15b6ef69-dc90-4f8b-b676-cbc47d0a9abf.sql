
-- ============================================================
-- FIX: orders_b2c missing UPDATE policies
-- Without these, admin cannot confirm/reject payments and
-- buyer cannot cancel their own orders
-- ============================================================

-- Admin can update any b2c order (confirm payment, change status, etc.)
CREATE POLICY "Admins can update any b2c order"
ON public.orders_b2c
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Buyer can cancel their own pending orders
CREATE POLICY "Buyers can update their own b2c orders"
ON public.orders_b2c
FOR UPDATE
TO authenticated
USING (buyer_user_id = auth.uid())
WITH CHECK (buyer_user_id = auth.uid());

-- Admin can SELECT all orders (needed for admin panel)
CREATE POLICY "Admins can view all b2c orders"
ON public.orders_b2c
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update order_items_b2c (needed for order processing)
CREATE POLICY "Admins can update b2c order items"
ON public.order_items_b2c
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can delete b2c order items if needed
CREATE POLICY "Admins can delete b2c order items"
ON public.order_items_b2c
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Buyer can delete items from their own orders (for rollback on cancel)
CREATE POLICY "Buyers can delete items from their own b2c orders"
ON public.order_items_b2c
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2c
    WHERE id = order_id AND buyer_user_id = auth.uid()
  )
);
