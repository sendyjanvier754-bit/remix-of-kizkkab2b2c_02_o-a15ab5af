-- Enable RLS on commission_debts
ALTER TABLE public.commission_debts ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own debts
CREATE POLICY "Sellers can view their own commission debts"
ON public.commission_debts
FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);

-- Admins can view all debts
CREATE POLICY "Admins can view all commission debts"
ON public.commission_debts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert debts
CREATE POLICY "Admins can insert commission debts"
ON public.commission_debts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update debts
CREATE POLICY "Admins can update commission debts"
ON public.commission_debts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete debts
CREATE POLICY "Admins can delete commission debts"
ON public.commission_debts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));