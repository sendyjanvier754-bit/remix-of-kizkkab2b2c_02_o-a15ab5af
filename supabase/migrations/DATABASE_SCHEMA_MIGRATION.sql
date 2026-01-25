-- ============================================
-- SIVER MARKET 509 - COMPLETE DATABASE SCHEMA
-- Migration Script for Supabase
-- Generated: 2026-01-25
-- ============================================

-- ============================================
-- SECTION 1: CUSTOM TYPES (ENUMS)
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'user', 'gestor', 'investor');
CREATE TYPE public.approval_request_type AS ENUM ('withdrawal', 'refund', 'credit_purchase', 'kyc_review');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('bank_transfer', 'moncash', 'natcash', 'credit_card', 'crypto', 'cash_on_delivery');
CREATE TYPE public.payment_status AS ENUM ('pending', 'pending_validation', 'paid', 'failed', 'expired', 'refunded', 'cancelled');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'discontinued');

-- ============================================
-- SECTION 2: HELPER FUNCTIONS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND role = 'admin'
  )
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- SECTION 3: CORE TABLES
-- ============================================

-- Profiles table (user information)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id),
  is_visible_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  country TEXT DEFAULT 'China',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shipping origins table
CREATE TABLE public.shipping_origins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products table (B2B catalog)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_interno TEXT UNIQUE,
  nombre TEXT NOT NULL,
  descripcion_corta TEXT,
  descripcion_larga TEXT,
  costo_base_excel NUMERIC,
  precio_mayorista NUMERIC,
  precio_sugerido_venta NUMERIC,
  precio_promocional NUMERIC,
  promo_active BOOLEAN DEFAULT false,
  promo_starts_at TIMESTAMPTZ,
  promo_ends_at TIMESTAMPTZ,
  moq INTEGER DEFAULT 1,
  stock_fisico INTEGER DEFAULT 0,
  stock_status stock_status DEFAULT 'in_stock',
  imagen_principal TEXT,
  galeria_imagenes TEXT[],
  categoria_id UUID REFERENCES public.categories(id),
  proveedor_id UUID REFERENCES public.suppliers(id),
  origin_country_id UUID REFERENCES public.shipping_origins(id),
  currency_code TEXT DEFAULT 'USD',
  url_origen TEXT,
  peso_kg NUMERIC,
  weight_kg NUMERIC,
  dimensiones_cm TEXT,
  length_cm NUMERIC,
  width_cm NUMERIC,
  height_cm NUMERIC,
  is_oversize BOOLEAN DEFAULT false,
  shipping_mode TEXT DEFAULT 'standard',
  is_active BOOLEAN DEFAULT true,
  is_parent BOOLEAN DEFAULT false,
  parent_product_id UUID REFERENCES public.products(id),
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  embedding vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product variants table
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT,
  option_type TEXT,
  option_value TEXT,
  attribute_combination JSONB DEFAULT '{}',
  price NUMERIC,
  cost_price NUMERIC,
  price_adjustment NUMERIC DEFAULT 0,
  precio_promocional NUMERIC,
  stock INTEGER DEFAULT 0,
  stock_b2c INTEGER DEFAULT 0,
  moq INTEGER DEFAULT 1,
  images TEXT[],
  batch_id UUID,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 4: EAV ATTRIBUTES SYSTEM
-- ============================================

-- Attributes master table
CREATE TABLE public.attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  attribute_type TEXT NOT NULL DEFAULT 'select',
  render_type TEXT NOT NULL DEFAULT 'chips',
  category_hint TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attribute options table
CREATE TABLE public.attribute_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_value TEXT NOT NULL,
  color_hex TEXT,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Variant attribute values (junction table)
CREATE TABLE public.variant_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.attributes(id),
  attribute_option_id UUID NOT NULL REFERENCES public.attribute_options(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Category attribute templates
CREATE TABLE public.category_attribute_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id),
  attribute_name TEXT NOT NULL,
  attribute_display_name TEXT NOT NULL,
  attribute_type TEXT DEFAULT 'text',
  render_type TEXT DEFAULT 'select',
  suggested_values TEXT[],
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 5: STORES AND SELLERS
-- ============================================

-- Stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo TEXT,
  banner TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  tiktok TEXT,
  city TEXT,
  country TEXT DEFAULT 'Haiti',
  is_active BOOLEAN DEFAULT true,
  is_accepting_orders BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT true,
  show_stock BOOLEAN DEFAULT true,
  shipping_policy TEXT,
  return_policy TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sellers table
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id),
  business_name TEXT,
  business_type TEXT,
  tax_id TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_status verification_status DEFAULT 'unverified',
  commission_rate NUMERIC DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller catalog (B2C inventory)
CREATE TABLE public.seller_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_store_id UUID NOT NULL REFERENCES public.stores(id),
  source_product_id UUID REFERENCES public.products(id),
  source_order_id UUID,
  sku TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_venta NUMERIC NOT NULL,
  precio_costo NUMERIC,
  stock INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  imported_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 6: LOGISTICS SYSTEM
-- ============================================

-- Transit hubs
CREATE TABLE public.transit_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Destination countries
CREATE TABLE public.destination_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shipping routes
CREATE TABLE public.shipping_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transit_hub_id UUID REFERENCES public.transit_hubs(id),
  destination_country_id UUID REFERENCES public.destination_countries(id),
  is_direct BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Route logistics costs
CREATE TABLE public.route_logistics_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_route_id UUID NOT NULL REFERENCES public.shipping_routes(id),
  segment TEXT NOT NULL, -- 'china_to_transit' or 'transit_to_destination'
  cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  cost_per_cbm NUMERIC DEFAULT 0,
  min_cost NUMERIC DEFAULT 0,
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments (administrative divisions)
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Communes (municipalities)
CREATE TABLE public.communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  rate_per_lb NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  operational_fee NUMERIC NOT NULL DEFAULT 0,
  extra_department_fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pickup points
CREATE TABLE public.pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  point_code TEXT UNIQUE,
  address TEXT,
  city TEXT,
  commune_id UUID REFERENCES public.communes(id),
  lat NUMERIC,
  lng NUMERIC,
  phone TEXT,
  email TEXT,
  opening_hours JSONB DEFAULT '{}',
  capacity INTEGER DEFAULT 100,
  is_official BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Category shipping rates
CREATE TABLE public.category_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id),
  fixed_fee NUMERIC NOT NULL DEFAULT 0,
  percentage_fee NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shipping rates (general)
CREATE TABLE public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 7: MARKETS SYSTEM
-- ============================================

-- Markets table
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  destination_country_id UUID REFERENCES public.destination_countries(id),
  shipping_route_id UUID REFERENCES public.shipping_routes(id),
  currency TEXT DEFAULT 'USD',
  timezone TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market payment methods
CREATE TABLE public.market_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id),
  method_type TEXT NOT NULL,
  name TEXT NOT NULL,
  account_number TEXT,
  account_holder TEXT,
  bank_name TEXT,
  instructions TEXT,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 8: B2B MARGIN RANGES
-- ============================================

CREATE TABLE public.b2b_margin_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_cost NUMERIC NOT NULL DEFAULT 0,
  max_cost NUMERIC,
  margin_percent NUMERIC NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 9: CARTS (B2B and B2C)
-- ============================================

-- B2B Carts
CREATE TABLE public.b2b_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B2B Cart Items
CREATE TABLE public.b2b_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.b2b_carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  color TEXT,
  size TEXT,
  image TEXT,
  variant_attributes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- B2C Carts
CREATE TABLE public.b2c_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B2C Cart Items
CREATE TABLE public.b2c_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.b2c_carts(id) ON DELETE CASCADE,
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  store_id UUID REFERENCES public.stores(id),
  variant_id UUID,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  color TEXT,
  size TEXT,
  image TEXT,
  store_name TEXT,
  store_whatsapp TEXT,
  variant_attributes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 10: ORDERS (B2B and B2C)
-- ============================================

-- B2B Orders
CREATE TABLE public.orders_b2b (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL, -- The buyer (seller purchasing wholesale)
  buyer_id UUID, -- Alternative reference
  po_id UUID, -- Purchase order reference
  order_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  payment_method TEXT,
  total_quantity INTEGER DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  stock_reserved BOOLEAN DEFAULT false,
  reservation_expires_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  po_linked_at TIMESTAMPTZ,
  consolidation_status TEXT,
  shipping_address JSONB DEFAULT '{}',
  billing_address JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B2B Order Items
CREATE TABLE public.order_items_b2b (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders_b2b(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC NOT NULL,
  precio_total NUMERIC NOT NULL,
  color TEXT,
  size TEXT,
  variant_attributes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- B2C Orders
CREATE TABLE public.orders_b2c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  order_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  payment_method TEXT,
  subtotal NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  shipping_address JSONB DEFAULT '{}',
  pickup_point_id UUID REFERENCES public.pickup_points(id),
  delivery_method TEXT DEFAULT 'pickup_point',
  estimated_delivery_date DATE,
  tracking_number TEXT,
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B2C Order Items
CREATE TABLE public.order_items_b2c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders_b2c(id) ON DELETE CASCADE,
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  sku TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  variant_info JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 11: CONSOLIDATION SYSTEM
-- ============================================

-- Master Purchase Orders
CREATE TABLE public.master_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'draft',
  total_orders INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  cycle_start_at TIMESTAMPTZ DEFAULT now(),
  cycle_end_at TIMESTAMPTZ,
  auto_close_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  orders_at_close INTEGER DEFAULT 0,
  china_tracking TEXT,
  transit_tracking TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PO Order Links
CREATE TABLE public.po_order_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id),
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL,
  source_type TEXT,
  customer_user_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  department_code TEXT,
  commune_code TEXT,
  pickup_point_code TEXT,
  short_order_id TEXT,
  unit_count INTEGER DEFAULT 0,
  current_status TEXT,
  hybrid_tracking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PO Picking Items
CREATE TABLE public.po_picking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id),
  po_order_link_id UUID REFERENCES public.po_order_links(id),
  product_id UUID,
  sku TEXT NOT NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL,
  picked_quantity INTEGER DEFAULT 0,
  is_picked BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consolidation Settings
CREATE TABLE public.consolidation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_mode TEXT DEFAULT 'hybrid',
  order_quantity_threshold INTEGER DEFAULT 50,
  time_interval_hours INTEGER DEFAULT 48,
  notify_on_close BOOLEAN DEFAULT true,
  notify_threshold_percent INTEGER DEFAULT 80,
  is_active BOOLEAN DEFAULT true,
  last_auto_close_at TIMESTAMPTZ,
  next_scheduled_close_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 12: WALLETS AND PAYMENTS
-- ============================================

-- Seller Wallets
CREATE TABLE public.seller_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE,
  available_balance NUMERIC DEFAULT 0,
  pending_balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet Transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.seller_wallets(id),
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC,
  balance_after NUMERIC,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Withdrawal Requests
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  wallet_id UUID REFERENCES public.seller_wallets(id),
  amount NUMERIC NOT NULL,
  fee_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC,
  payment_method TEXT NOT NULL,
  payment_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B2B Payments
CREATE TABLE public.b2b_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  payment_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  method payment_method NOT NULL,
  reference TEXT NOT NULL,
  status payment_status DEFAULT 'pending',
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment Methods (store-level)
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  method_type TEXT NOT NULL,
  name TEXT NOT NULL,
  account_number TEXT,
  account_holder TEXT,
  bank_name TEXT,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 13: CREDITS SYSTEM
-- ============================================

-- Seller Credits
CREATE TABLE public.seller_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  total_used NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit Movements
CREATE TABLE public.credit_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  movement_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referral System
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  referral_code_id UUID REFERENCES public.referral_codes(id),
  status TEXT DEFAULT 'pending',
  reward_amount NUMERIC DEFAULT 0,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_reward NUMERIC DEFAULT 5,
  referred_reward NUMERIC DEFAULT 5,
  min_purchase_amount NUMERIC DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 14: DISCOUNTS
-- ============================================

-- Discount Codes
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  min_purchase_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  store_id UUID REFERENCES public.stores(id),
  applies_to TEXT DEFAULT 'all',
  applicable_ids UUID[] DEFAULT '{}',
  created_by UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Discount Code Uses
CREATE TABLE public.discount_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id),
  user_id UUID NOT NULL,
  order_id UUID,
  discount_applied NUMERIC NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now()
);

-- Customer Discounts
CREATE TABLE public.customer_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id),
  customer_user_id UUID NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  reason TEXT,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 15: COMMISSIONS
-- ============================================

-- Commission Overrides
CREATE TABLE public.commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID,
  category_id UUID REFERENCES public.categories(id),
  commission_rate NUMERIC NOT NULL,
  reason TEXT,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seller Commission Overrides
CREATE TABLE public.seller_commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE,
  commission_percentage NUMERIC,
  commission_fixed NUMERIC,
  tax_tca_percentage NUMERIC,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Commission Debts
CREATE TABLE public.commission_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  wallet_id UUID REFERENCES public.seller_wallets(id),
  order_id UUID,
  order_type TEXT,
  sale_amount NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_debt NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  paid_from_wallet BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 16: KYC VERIFICATION
-- ============================================

CREATE TABLE public.kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status verification_status DEFAULT 'unverified',
  document_type TEXT,
  document_number TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  business_registration_url TEXT,
  address_proof_url TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_comments TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 17: NOTIFICATIONS
-- ============================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  wallet_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 18: ADDRESSES
-- ============================================

CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Casa',
  full_name TEXT NOT NULL,
  phone TEXT,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'Haiti',
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  preferred_pickup_point_id UUID REFERENCES public.pickup_points(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 19: FAVORITES AND REVIEWS
-- ============================================

-- User Favorites (B2C)
CREATE TABLE public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  store_id UUID REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, seller_catalog_id)
);

-- Seller Favorites (B2B products)
CREATE TABLE public.seller_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Product Reviews
CREATE TABLE public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id),
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  images TEXT[],
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store Reviews
CREATE TABLE public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store Followers
CREATE TABLE public.store_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- Delivery Ratings
CREATE TABLE public.delivery_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type VARCHAR DEFAULT 'b2c',
  order_delivery_id UUID,
  customer_user_id UUID NOT NULL,
  product_rating INTEGER CHECK (product_rating >= 1 AND product_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  product_comment TEXT,
  delivery_comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  rated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 20: PLATFORM SETTINGS
-- ============================================

CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.marketplace_section_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  item_limit INTEGER DEFAULT 10,
  display_mode TEXT DEFAULT 'carousel',
  custom_config JSONB DEFAULT '{}',
  target_audience TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.admin_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type approval_request_type NOT NULL,
  requester_id UUID NOT NULL,
  status approval_status DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  amount NUMERIC,
  admin_comments TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 21: INVENTORY MANAGEMENT
-- ============================================

-- Inventory Movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  product_id UUID REFERENCES public.products(id),
  change_amount INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Reservations
CREATE TABLE public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID,
  variant_id UUID,
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'reserved',
  reserved_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B2B Batches
CREATE TABLE public.b2b_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT NOT NULL,
  order_id UUID REFERENCES public.orders_b2b(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  total_quantity INTEGER DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  purchase_date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Batch Inventory
CREATE TABLE public.batch_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.b2b_batches(id),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  quantity_purchased INTEGER DEFAULT 0,
  quantity_available INTEGER,
  quantity_sold INTEGER DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 22: DELIVERY SYSTEM
-- ============================================

-- Order Deliveries
CREATE TABLE public.order_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type VARCHAR DEFAULT 'b2c',
  pickup_point_id UUID REFERENCES public.pickup_points(id),
  delivery_code TEXT,
  delivery_method VARCHAR DEFAULT 'pickup_point',
  status VARCHAR DEFAULT 'pending',
  customer_qr_code TEXT,
  security_pin TEXT,
  assigned_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  escrow_release_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shipment Tracking
CREATE TABLE public.shipment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type TEXT DEFAULT 'b2b',
  po_id UUID,
  tracking_number TEXT,
  carrier TEXT,
  china_tracking TEXT,
  transit_tracking TEXT,
  hybrid_tracking_id TEXT,
  current_status TEXT DEFAULT 'pending',
  current_location TEXT,
  estimated_delivery DATE,
  events JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pickup Point Staff
CREATE TABLE public.pickup_point_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_point_id UUID NOT NULL REFERENCES public.pickup_points(id),
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'operator',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 23: ANALYTICS TABLES
-- ============================================

-- Catalog Click Tracking
CREATE TABLE public.catalog_click_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID,
  product_id UUID,
  variant_id UUID,
  source_type TEXT DEFAULT 'pdf',
  source_campaign TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  converted_to_cart BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT,
  device_type TEXT
);

-- Product Views
CREATE TABLE public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id),
  seller_catalog_id UUID REFERENCES public.seller_catalog(id),
  user_id UUID,
  session_id TEXT,
  view_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Price History
CREATE TABLE public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id),
  price_type TEXT NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC NOT NULL,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 24: ASSET PROCESSING
-- ============================================

CREATE TABLE public.asset_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  status TEXT DEFAULT 'pending',
  total_assets INTEGER DEFAULT 0,
  processed_assets INTEGER DEFAULT 0,
  failed_assets INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_processing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.asset_processing_jobs(id),
  row_index INTEGER NOT NULL,
  sku_interno TEXT NOT NULL,
  original_url TEXT NOT NULL,
  storage_path TEXT,
  public_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECTION 25: ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2c_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2c_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_b2b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items_b2b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_b2c ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items_b2c ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transit_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_logistics_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_margin_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_picking_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 26: RLS POLICIES (ESSENTIAL)
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (is_admin(auth.uid()));

-- Categories policies
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (is_admin(auth.uid()));

-- Products policies
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (is_admin(auth.uid()));

-- B2B Cart policies
CREATE POLICY "Users can view own carts" ON public.b2b_carts FOR SELECT USING (buyer_user_id = auth.uid());
CREATE POLICY "Users can create own carts" ON public.b2b_carts FOR INSERT WITH CHECK (buyer_user_id = auth.uid());
CREATE POLICY "Users can update own carts" ON public.b2b_carts FOR UPDATE USING (buyer_user_id = auth.uid());

-- Stores policies
CREATE POLICY "Public can view active stores" ON public.stores FOR SELECT USING (is_active = true);
CREATE POLICY "Owners can manage their stores" ON public.stores FOR ALL USING (owner_user_id = auth.uid());

-- Addresses policies
CREATE POLICY "Users can view their own addresses" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Logistics tables - public read
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Anyone can view communes" ON public.communes FOR SELECT USING (true);
CREATE POLICY "Anyone can view pickup points" ON public.pickup_points FOR SELECT USING (is_active = true);
CREATE POLICY "Public read shipping routes" ON public.shipping_routes FOR SELECT USING (true);
CREATE POLICY "Public read transit hubs" ON public.transit_hubs FOR SELECT USING (true);
CREATE POLICY "Public read destination countries" ON public.destination_countries FOR SELECT USING (true);
CREATE POLICY "Public read route costs" ON public.route_logistics_costs FOR SELECT USING (true);
CREATE POLICY "Public read markets" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Public read market payment methods" ON public.market_payment_methods FOR SELECT USING (true);
CREATE POLICY "Public read margin ranges" ON public.b2b_margin_ranges FOR SELECT USING (true);

-- Admins can manage logistics
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage communes" ON public.communes FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage pickup points" ON public.pickup_points FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage shipping routes" ON public.shipping_routes FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage transit hubs" ON public.transit_hubs FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage destination countries" ON public.destination_countries FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage route costs" ON public.route_logistics_costs FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage markets" ON public.markets FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage market payment methods" ON public.market_payment_methods FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage margin ranges" ON public.b2b_margin_ranges FOR ALL USING (is_admin(auth.uid()));

-- ============================================
-- SECTION 27: INDEXES
-- ============================================

CREATE INDEX idx_products_categoria ON public.products(categoria_id);
CREATE INDEX idx_products_sku ON public.products(sku_interno);
CREATE INDEX idx_products_active ON public.products(is_active);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX idx_seller_catalog_store ON public.seller_catalog(seller_store_id);
CREATE INDEX idx_seller_catalog_source ON public.seller_catalog(source_product_id);
CREATE INDEX idx_orders_b2b_seller ON public.orders_b2b(seller_id);
CREATE INDEX idx_orders_b2b_status ON public.orders_b2b(status);
CREATE INDEX idx_orders_b2c_buyer ON public.orders_b2c(buyer_user_id);
CREATE INDEX idx_orders_b2c_store ON public.orders_b2c(store_id);
CREATE INDEX idx_b2b_cart_items_cart ON public.b2b_cart_items(cart_id);
CREATE INDEX idx_b2c_cart_items_cart ON public.b2c_cart_items(cart_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read);

-- ============================================
-- END OF MIGRATION SCRIPT
-- ============================================
