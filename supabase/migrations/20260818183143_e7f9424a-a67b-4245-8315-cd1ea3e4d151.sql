CREATE TABLE public.whatsapp_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp_support',
  page_url TEXT,
  message TEXT,
  user_id UUID,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_leads_email ON public.whatsapp_leads (lower(email));

GRANT INSERT ON public.whatsapp_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_leads TO authenticated;
GRANT ALL ON public.whatsapp_leads TO service_role;

ALTER TABLE public.whatsapp_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a whatsapp lead"
ON public.whatsapp_leads FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view whatsapp leads"
ON public.whatsapp_leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update whatsapp leads"
ON public.whatsapp_leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));