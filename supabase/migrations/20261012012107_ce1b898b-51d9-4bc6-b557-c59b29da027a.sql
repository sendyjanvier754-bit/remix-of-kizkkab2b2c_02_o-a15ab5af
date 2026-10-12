CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders_b2c(id) ON DELETE CASCADE,
  store_id uuid,
  gross_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held',
  release_at timestamptz,
  released_at timestamptz,
  paid_at timestamptz,
  paid_by uuid,
  payment_method text,
  payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage payouts" ON public.seller_payouts;
CREATE POLICY "Admins manage payouts" ON public.seller_payouts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Store owners view payouts" ON public.seller_payouts;
CREATE POLICY "Store owners view payouts" ON public.seller_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_seller_payouts_updated ON public.seller_payouts;
CREATE TRIGGER trg_seller_payouts_updated BEFORE UPDATE ON public.seller_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value, description)
SELECT 'b2c_payout_hold_days', '7', 'Días sin reclamos tras la entrega antes de liberar el pago al vendedor'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key='b2c_payout_hold_days');

CREATE OR REPLACE FUNCTION public.fn_create_seller_payout_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pct numeric; v_comm numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') AND NEW.store_id IS NOT NULL THEN
    SELECT COALESCE(value::numeric, 10) INTO v_pct FROM platform_settings WHERE key='commission_percentage';
    v_comm := round(COALESCE(NEW.total_amount,0) * COALESCE(v_pct,10) / 100, 2);
    INSERT INTO seller_payouts (order_id, store_id, gross_amount, commission_amount, net_amount, status)
    VALUES (NEW.id, NEW.store_id, COALESCE(NEW.total_amount,0), v_comm, COALESCE(NEW.total_amount,0) - v_comm, 'held')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE seller_payouts SET release_at = now() + make_interval(days => COALESCE(
      (SELECT value::int FROM platform_settings WHERE key='b2c_payout_hold_days'), 7))
    WHERE order_id = NEW.id AND status = 'held';
  END IF;
  IF NEW.status IN ('cancelled','refunded') OR NEW.payment_status::text IN ('refunded','cancelled') THEN
    UPDATE seller_payouts SET status='cancelled' WHERE order_id = NEW.id AND status IN ('held','releasable');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_create_seller_payout ON public.orders_b2c;
CREATE TRIGGER trg_create_seller_payout AFTER UPDATE ON public.orders_b2c
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_seller_payout_on_paid();

CREATE OR REPLACE FUNCTION public.release_eligible_seller_payouts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE seller_payouts p SET status='releasable', released_at=now()
  WHERE p.status='held' AND p.release_at IS NOT NULL AND p.release_at <= now()
    AND NOT EXISTS (SELECT 1 FROM order_return_requests r WHERE r.order_id = p.order_id
      AND r.status NOT IN ('rejected','cancelled','completed','closed'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.release_eligible_seller_payouts() FROM anon;
GRANT EXECUTE ON FUNCTION public.release_eligible_seller_payouts() TO authenticated;