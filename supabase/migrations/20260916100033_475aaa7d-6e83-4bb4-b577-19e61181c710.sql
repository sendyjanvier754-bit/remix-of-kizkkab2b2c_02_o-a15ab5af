CREATE TABLE public.affiliate_payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method_id UUID REFERENCES public.affiliate_payout_methods(id),
  payment_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_payout_requests_affiliate ON public.affiliate_payout_requests(affiliate_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_payout_requests TO authenticated;
GRANT ALL ON public.affiliate_payout_requests TO service_role;

ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates read own payout requests"
ON public.affiliate_payout_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE POLICY "Affiliates create own payout requests"
ON public.affiliate_payout_requests FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE POLICY "Admins manage payout requests"
ON public.affiliate_payout_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_affiliate_payout_requests_touch
BEFORE UPDATE ON public.affiliate_payout_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();