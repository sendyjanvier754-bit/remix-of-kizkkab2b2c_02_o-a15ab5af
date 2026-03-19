
-- Seller onboarding progress table
CREATE TABLE public.seller_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  steps_completed JSONB DEFAULT '{}',
  current_step TEXT DEFAULT 'store_info',
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own onboarding progress
CREATE POLICY "Users can read own onboarding progress"
  ON public.seller_onboarding_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own onboarding progress
CREATE POLICY "Users can insert own onboarding progress"
  ON public.seller_onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own onboarding progress
CREATE POLICY "Users can update own onboarding progress"
  ON public.seller_onboarding_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all onboarding progress
CREATE POLICY "Admins can read all onboarding progress"
  ON public.seller_onboarding_progress FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all onboarding progress
CREATE POLICY "Admins can update all onboarding progress"
  ON public.seller_onboarding_progress FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
