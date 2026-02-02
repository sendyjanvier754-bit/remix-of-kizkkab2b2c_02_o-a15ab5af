-- ============================================================================
-- B2B MULTITRAMO ENGINE - MIGRATION PART 1: BASE TABLES
-- ============================================================================

-- 1. TABLA: shipping_zones (Zonificación por país)
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID REFERENCES public.destination_countries(id),
  zone_code VARCHAR(10) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_level INTEGER NOT NULL DEFAULT 1,
  surcharge_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_capital BOOLEAN DEFAULT false,
  is_remote BOOLEAN DEFAULT false,
  coverage_active BOOLEAN DEFAULT true,
  min_delivery_days INTEGER DEFAULT 1,
  max_delivery_days INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(country_id, zone_code)
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping zones viewable by authenticated" ON public.shipping_zones 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage shipping zones" ON public.shipping_zones 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 2. TABLA: shipping_tiers
CREATE TABLE IF NOT EXISTS public.shipping_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.shipping_routes(id) ON DELETE CASCADE,
  tier_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  tier_name VARCHAR(100) NOT NULL,
  tier_description TEXT,
  tramo_a_cost_per_kg NUMERIC(10,4) NOT NULL DEFAULT 0,
  tramo_a_min_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  tramo_a_eta_min INTEGER DEFAULT 15,
  tramo_a_eta_max INTEGER DEFAULT 25,
  tramo_b_cost_per_lb NUMERIC(10,4) NOT NULL DEFAULT 0,
  tramo_b_min_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  tramo_b_eta_min INTEGER DEFAULT 3,
  tramo_b_eta_max INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  allows_oversize BOOLEAN DEFAULT true,
  allows_sensitive BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(route_id, tier_type)
);

ALTER TABLE public.shipping_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping tiers viewable by authenticated" ON public.shipping_tiers 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage shipping tiers" ON public.shipping_tiers 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 3. TABLA: product_shipping_classes
CREATE TABLE IF NOT EXISTS public.product_shipping_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  is_oversize BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  sensitivity_type VARCHAR(50),
  oversize_surcharge_percent NUMERIC(5,2) DEFAULT 0,
  sensitive_surcharge_per_gram NUMERIC(10,4) DEFAULT 0,
  allows_express BOOLEAN DEFAULT true,
  requires_special_packing BOOLEAN DEFAULT false,
  packing_instructions TEXT,
  volume_factor NUMERIC(10,2) DEFAULT 5000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_shipping_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product shipping classes viewable" ON public.product_shipping_classes 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product shipping classes" ON public.product_shipping_classes 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 4. ALTER communes
ALTER TABLE public.communes ADD COLUMN IF NOT EXISTS shipping_zone_id UUID REFERENCES public.shipping_zones(id);

-- 5. ALTER products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight_g NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10,2) DEFAULT 0;

-- 6. ALTER orders_b2b - agregar master_po_id primero
ALTER TABLE public.orders_b2b
ADD COLUMN IF NOT EXISTS master_po_id UUID REFERENCES public.master_purchase_orders(id),
ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES public.addresses(id),
ADD COLUMN IF NOT EXISTS shipping_tier_type VARCHAR(20) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS hybrid_tracking_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_express BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_oversize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS packing_instructions TEXT,
ADD COLUMN IF NOT EXISTS total_weight_g NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_weight_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_weight_lb NUMERIC(10,2) DEFAULT 0;

-- 7. ALTER master_purchase_orders
ALTER TABLE public.master_purchase_orders
ADD COLUMN IF NOT EXISTS has_express_orders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_oversize_orders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_sensitive_orders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS department_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS hub_code VARCHAR(10) DEFAULT 'MIA';

-- 8. Índices
CREATE INDEX IF NOT EXISTS idx_shipping_zones_country ON shipping_zones(country_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_active ON shipping_zones(coverage_active);
CREATE INDEX IF NOT EXISTS idx_shipping_tiers_route ON shipping_tiers(route_id);
CREATE INDEX IF NOT EXISTS idx_shipping_tiers_type ON shipping_tiers(tier_type);
CREATE INDEX IF NOT EXISTS idx_product_shipping_classes_product ON product_shipping_classes(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_b2b_master_po ON orders_b2b(master_po_id);
CREATE INDEX IF NOT EXISTS idx_orders_b2b_express ON orders_b2b(is_express) WHERE is_express = true;
CREATE INDEX IF NOT EXISTS idx_communes_zone ON communes(shipping_zone_id);