
-- ============================================================================
-- AFFILIATE ECOSYSTEM: Tables, RLS, Functions
-- ============================================================================

-- 1. Affiliate Programs table
CREATE TABLE public.affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  role_target TEXT NOT NULL DEFAULT 'user' CHECK (role_target IN ('seller', 'user')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_programs ENABLE ROW LEVEL SECURITY;

-- Admin full access using security definer
CREATE POLICY "affiliate_programs_admin_all" ON public.affiliate_programs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated can read active programs
CREATE POLICY "affiliate_programs_read_active" ON public.affiliate_programs
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 2. Extend profiles with program_id and referral_code
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_program_id UUID REFERENCES public.affiliate_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 3. Affiliate Earnings table
CREATE TABLE public.affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;

-- Users can read their own earnings
CREATE POLICY "affiliate_earnings_own_read" ON public.affiliate_earnings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin full access
CREATE POLICY "affiliate_earnings_admin_all" ON public.affiliate_earnings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Waiting List table
CREATE TABLE public.waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL DEFAULT 'affiliate_benefits',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature)
);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Users can insert/read their own
CREATE POLICY "waiting_list_own_insert" ON public.waiting_list
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "waiting_list_own_read" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin can read all
CREATE POLICY "waiting_list_admin_read" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
