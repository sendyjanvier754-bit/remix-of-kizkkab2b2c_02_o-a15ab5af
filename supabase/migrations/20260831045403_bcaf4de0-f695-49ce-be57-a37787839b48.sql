GRANT SELECT ON public.pickup_points TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_points TO authenticated;
GRANT ALL ON public.pickup_points TO service_role;

ALTER TABLE public.pickup_points ALTER COLUMN is_active SET DEFAULT true;

DROP POLICY IF EXISTS "Admins can manage pickup points" ON public.pickup_points;
CREATE POLICY "Admins can manage pickup points"
ON public.pickup_points
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS set_pickup_points_updated_at ON public.pickup_points;
CREATE TRIGGER set_pickup_points_updated_at
BEFORE UPDATE ON public.pickup_points
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();