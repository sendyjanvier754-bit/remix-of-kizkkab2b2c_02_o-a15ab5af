
CREATE TABLE public.order_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  reason_type TEXT,
  amount_requested NUMERIC(10,2),
  amount_approved NUMERIC(10,2),
  resolution_type TEXT,
  seller_notes TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.validate_order_return_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_type NOT IN ('b2b', 'b2c') THEN
    RAISE EXCEPTION 'order_type must be b2b or b2c';
  END IF;
  IF NEW.status NOT IN ('pending','accepted','rejected','processing','completed','agreement_reached','under_mediation','cancelled') THEN
    RAISE EXCEPTION 'invalid status value';
  END IF;
  IF NEW.resolution_type IS NOT NULL AND NEW.resolution_type NOT IN ('refund','exchange','store_credit','agreement') THEN
    RAISE EXCEPTION 'invalid resolution_type value';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_order_return_request_trigger
  BEFORE INSERT OR UPDATE ON public.order_return_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_return_request();

ALTER TABLE public.order_return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_returns" ON public.order_return_requests
  FOR ALL TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "seller_view_returns" ON public.order_return_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "seller_update_returns" ON public.order_return_requests
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "admin_all_returns" ON public.order_return_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_return_requests_buyer_id ON public.order_return_requests(buyer_id);
CREATE INDEX idx_return_requests_seller_id ON public.order_return_requests(seller_id);
CREATE INDEX idx_return_requests_order_id ON public.order_return_requests(order_id);
CREATE INDEX idx_return_requests_status ON public.order_return_requests(status);
