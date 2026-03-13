-- Tabla para que los usuarios guarden sus propias cuentas/perfiles de pago
CREATE TABLE IF NOT EXISTS public.user_payment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('bank', 'moncash', 'natcash', 'stripe')),
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  account_type TEXT,
  bank_swift TEXT,
  phone_number TEXT,
  holder_name TEXT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, admin_payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_user_payment_profiles_user_id ON public.user_payment_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_profiles_method_type ON public.user_payment_profiles(method_type);

CREATE OR REPLACE FUNCTION public.update_user_payment_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_payment_profiles_updated_at ON public.user_payment_profiles;
CREATE TRIGGER trg_user_payment_profiles_updated_at
  BEFORE UPDATE ON public.user_payment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_payment_profiles_updated_at();

ALTER TABLE public.user_payment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_payment_profiles_select"
  ON public.user_payment_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_payment_profiles_insert"
  ON public.user_payment_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_payment_profiles_update"
  ON public.user_payment_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_payment_profiles_delete"
  ON public.user_payment_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_can_view_all_payment_profiles"
  ON public.user_payment_profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));