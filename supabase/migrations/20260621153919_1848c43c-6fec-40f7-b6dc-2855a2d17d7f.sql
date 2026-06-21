
CREATE TABLE public.stripe_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  publishable_key TEXT NOT NULL DEFAULT '',
  secret_key TEXT NOT NULL DEFAULT '',
  webhook_secret TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stripe_settings_one_active ON public.stripe_settings (is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_settings TO authenticated;
GRANT ALL ON public.stripe_settings TO service_role;

ALTER TABLE public.stripe_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stripe settings"
ON public.stripe_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert stripe settings"
ON public.stripe_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update stripe settings"
ON public.stripe_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete stripe settings"
ON public.stripe_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_stripe_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_stripe_settings_updated_at
  BEFORE UPDATE ON public.stripe_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_stripe_settings_updated_at();

CREATE OR REPLACE FUNCTION public.get_active_stripe_publishable_key()
RETURNS TABLE (publishable_key TEXT, mode TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT publishable_key, mode FROM public.stripe_settings WHERE is_active = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_stripe_publishable_key() TO anon, authenticated;
