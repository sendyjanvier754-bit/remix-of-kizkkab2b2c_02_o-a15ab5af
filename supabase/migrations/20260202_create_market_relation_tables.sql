-- ============================================================================
-- CREATE MISSING TABLES: product_markets, seller_markets, category_markets
-- ============================================================================

-- 1. PRODUCT_MARKETS - Relation between products and markets
CREATE TABLE IF NOT EXISTS public.product_markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  price_override NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, market_id)
);

-- 2. SELLER_MARKETS - Relation between sellers and markets
CREATE TABLE IF NOT EXISTS public.seller_markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(seller_id, market_id)
);

-- 3. CATEGORY_MARKETS - Relation between categories and markets
CREATE TABLE IF NOT EXISTS public.category_markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, market_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_markets_product ON public.product_markets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_markets_market ON public.product_markets(market_id);
CREATE INDEX IF NOT EXISTS idx_seller_markets_seller ON public.seller_markets(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_markets_market ON public.seller_markets(market_id);
CREATE INDEX IF NOT EXISTS idx_category_markets_category ON public.category_markets(category_id);
CREATE INDEX IF NOT EXISTS idx_category_markets_market ON public.category_markets(market_id);

-- Enable RLS
ALTER TABLE public.product_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_markets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read, admin manage
CREATE POLICY "product_markets_select" ON public.product_markets FOR SELECT USING (true);
CREATE POLICY "product_markets_manage" ON public.product_markets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "seller_markets_select" ON public.seller_markets FOR SELECT USING (true);
CREATE POLICY "seller_markets_manage" ON public.seller_markets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "category_markets_select" ON public.category_markets FOR SELECT USING (true);
CREATE POLICY "category_markets_manage" ON public.category_markets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Verify tables were created
SELECT 
  'Tables created successfully' as status,
  (SELECT COUNT(*) FROM public.product_markets) as product_markets_count,
  (SELECT COUNT(*) FROM public.seller_markets) as seller_markets_count,
  (SELECT COUNT(*) FROM public.category_markets) as category_markets_count;
