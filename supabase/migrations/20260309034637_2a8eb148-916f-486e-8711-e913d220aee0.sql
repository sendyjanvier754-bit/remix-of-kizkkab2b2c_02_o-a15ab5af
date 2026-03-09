
-- Store shipping options: allows sellers to configure shipping tiers for B2C
CREATE TABLE public.store_shipping_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. 'Standard', 'Express'
  description TEXT,
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_days_min INTEGER NOT NULL DEFAULT 1,
  estimated_days_max INTEGER NOT NULL DEFAULT 7,
  is_free_above NUMERIC(10,2), -- Free shipping above this amount
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_shipping_options ENABLE ROW LEVEL SECURITY;

-- Sellers can manage their own store shipping options
CREATE POLICY "Sellers can manage own store shipping options"
  ON public.store_shipping_options
  FOR ALL
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_user_id = auth.uid())
  );

-- Anyone can read active shipping options (for checkout)
CREATE POLICY "Anyone can read active shipping options"
  ON public.store_shipping_options
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Add payment_reference column to orders_b2c for tracking
ALTER TABLE public.orders_b2c ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders_b2c ADD COLUMN IF NOT EXISTS payment_verified_by UUID;
ALTER TABLE public.orders_b2c ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- Index for store lookups
CREATE INDEX IF NOT EXISTS idx_store_shipping_options_store_id ON public.store_shipping_options(store_id);
