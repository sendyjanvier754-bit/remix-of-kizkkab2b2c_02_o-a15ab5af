
CREATE POLICY "Pickup managers view assigned b2c orders"
ON public.orders_b2c FOR SELECT TO authenticated
USING (public.is_order_pickup_manager(id, auth.uid()));

CREATE POLICY "Pickup managers update assigned b2c orders"
ON public.orders_b2c FOR UPDATE TO authenticated
USING (public.is_order_pickup_manager(id, auth.uid()))
WITH CHECK (public.is_order_pickup_manager(id, auth.uid()));

CREATE POLICY "Pickup managers view assigned b2c order items"
ON public.order_items_b2c FOR SELECT TO authenticated
USING (public.is_order_pickup_manager(order_id, auth.uid()));

CREATE POLICY "Pickup managers view deliveries of their point"
ON public.order_deliveries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pickup_point_managers ppm
    WHERE ppm.pickup_point_id = order_deliveries.pickup_point_id
      AND ppm.user_id = auth.uid()
      AND ppm.is_active = true
  )
);
