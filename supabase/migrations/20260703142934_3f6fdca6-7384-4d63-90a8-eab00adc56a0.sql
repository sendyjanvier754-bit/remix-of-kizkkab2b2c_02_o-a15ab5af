
GRANT SELECT, INSERT, UPDATE ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own KYC" ON public.kyc_verifications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own KYC" ON public.kyc_verifications
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own KYC" ON public.kyc_verifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete KYC" ON public.kyc_verifications
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
