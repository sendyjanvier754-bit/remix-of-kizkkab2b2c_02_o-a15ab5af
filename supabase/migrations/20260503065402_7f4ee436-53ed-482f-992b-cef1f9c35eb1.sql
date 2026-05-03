GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_applications TO authenticated;
GRANT SELECT, INSERT ON public.partner_applications TO anon;
NOTIFY pgrst, 'reload schema';