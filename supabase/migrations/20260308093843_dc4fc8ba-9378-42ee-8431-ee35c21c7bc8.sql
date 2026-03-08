
-- Marketing Pop-ups table
CREATE TABLE public.marketing_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  
  -- Trigger type: welcome, exit_intent, cart_abandon, timed_promotion
  trigger_type TEXT NOT NULL DEFAULT 'welcome',
  
  -- Content
  heading TEXT NOT NULL,
  body_text TEXT,
  image_url TEXT,
  button_text TEXT DEFAULT 'Obtener Descuento',
  button_url TEXT,
  background_color TEXT DEFAULT '#ffffff',
  
  -- Coupon relation
  discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  auto_generate_coupon BOOLEAN DEFAULT false,
  auto_coupon_config JSONB DEFAULT '{}',
  -- auto_coupon_config example: { "discount_type": "percentage", "discount_value": 10, "prefix": "POPUP", "max_uses_per_user": 1 }
  
  -- Display rules
  display_frequency TEXT DEFAULT 'once_per_session', -- once_per_session, once_per_day, once_ever, always
  delay_seconds INTEGER DEFAULT 3,
  scroll_percentage INTEGER, -- for scroll-triggered
  
  -- Scheduling
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Targeting
  target_audience TEXT DEFAULT 'all', -- all, new_visitors, returning, b2b, b2c
  target_pages TEXT[] DEFAULT '{}', -- specific page paths, empty = all pages
  
  -- Stats
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  
  -- Meta
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('welcome', 'exit_intent', 'cart_abandon', 'timed_promotion')),
  CONSTRAINT valid_display_frequency CHECK (display_frequency IN ('once_per_session', 'once_per_day', 'once_ever', 'always'))
);

-- Enable RLS
ALTER TABLE public.marketing_popups ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (using has_role function)
CREATE POLICY "Admins can manage popups" ON public.marketing_popups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Everyone can read active popups (for display on storefront)
CREATE POLICY "Anyone can read active popups" ON public.marketing_popups
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

-- Popup dismiss tracking table
CREATE TABLE public.popup_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES public.marketing_popups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  dismissed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.popup_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dismissals" ON public.popup_dismissals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anon can insert dismissals" ON public.popup_dismissals
  FOR INSERT TO anon
  WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_marketing_popups_active ON public.marketing_popups (is_active, starts_at, ends_at) WHERE is_active = true;
CREATE INDEX idx_popup_dismissals_user ON public.popup_dismissals (user_id, popup_id);
CREATE INDEX idx_popup_dismissals_session ON public.popup_dismissals (session_id, popup_id);
