DROP POLICY IF EXISTS "Applicant or admin view application" ON public.partner_applications;

CREATE POLICY "Applicant or admin view application"
ON public.partner_applications
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() IS NOT NULL
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  OR approved_user_id = auth.uid()
);

NOTIFY pgrst, 'reload schema';