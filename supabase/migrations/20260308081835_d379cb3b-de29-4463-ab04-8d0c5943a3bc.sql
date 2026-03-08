-- RLS policies for master_purchase_orders
-- Admins can do everything
CREATE POLICY "Admins full access to master_purchase_orders"
  ON public.master_purchase_orders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sellers can read POs
CREATE POLICY "Sellers can read master_purchase_orders"
  ON public.master_purchase_orders
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'seller'));

-- Sales agents can read POs
CREATE POLICY "Sales agents can read master_purchase_orders"
  ON public.master_purchase_orders
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'sales_agent'));