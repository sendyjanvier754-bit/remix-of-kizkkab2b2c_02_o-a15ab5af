CREATE TABLE public.cart_recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL,
  cart_type text NOT NULL DEFAULT 'b2c',
  user_id uuid NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  email_sent boolean NOT NULL DEFAULT false,
  whatsapp_sent boolean NOT NULL DEFAULT false,
  cart_total numeric NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  recovered_at timestamptz,
  recovered_order_id uuid,
  recovered_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, attempt)
);
GRANT SELECT ON public.cart_recovery_logs TO authenticated;
GRANT ALL ON public.cart_recovery_logs TO service_role;
ALTER TABLE public.cart_recovery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cart recovery logs" ON public.cart_recovery_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_cart_recovery_logs_updated BEFORE UPDATE ON public.cart_recovery_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ref_id uuid NOT NULL,
  ref_key text NOT NULL DEFAULT '',
  store_id uuid,
  email_sent boolean NOT NULL DEFAULT false,
  whatsapp_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id, ref_key)
);
GRANT SELECT ON public.seller_notification_logs TO authenticated;
GRANT ALL ON public.seller_notification_logs TO service_role;
ALTER TABLE public.seller_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read seller notification logs" ON public.seller_notification_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS design_blocks jsonb;