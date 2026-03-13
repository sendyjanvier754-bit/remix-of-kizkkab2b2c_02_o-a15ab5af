-- Add RLS policies for store owners on orders_b2c and order_items_b2c

-- 1. Store owners can SELECT their store's B2C orders
CREATE POLICY "Store owners can view their store b2c orders"
ON public.orders_b2c FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
);

-- 2. Store owners can UPDATE their store's B2C orders
CREATE POLICY "Store owners can update their store b2c orders"
ON public.orders_b2c FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
);

-- 3. Store owners can SELECT order items for their store's orders
CREATE POLICY "Store owners can view their store b2c order items"
ON public.order_items_b2c FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2c
    JOIN public.stores ON stores.id = orders_b2c.store_id
    WHERE orders_b2c.id = order_items_b2c.order_id
      AND stores.owner_user_id = auth.uid()
  )
);