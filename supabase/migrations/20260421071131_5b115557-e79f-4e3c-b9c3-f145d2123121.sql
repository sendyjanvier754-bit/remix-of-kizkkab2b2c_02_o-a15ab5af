-- Función helper is_grossiste
CREATE OR REPLACE FUNCTION public.is_grossiste(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'grossiste')
$$;

-- Columnas en products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_role app_role DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_approval_status_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_approval_status_check
      CHECK (approval_status IN ('draft','pending_review','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON public.products(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON public.products(approval_status);

-- grossiste_profiles
CREATE TABLE IF NOT EXISTS public.grossiste_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT, legal_name TEXT, tax_id TEXT,
  country TEXT, city TEXT, address TEXT, phone TEXT, email TEXT,
  logo_url TEXT, banner_url TEXT, description TEXT,
  enable_b2c_storefront BOOLEAN NOT NULL DEFAULT false,
  b2c_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected','suspended')),
  verification_notes TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grossiste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grossiste_profiles_owner_read" ON public.grossiste_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "grossiste_profiles_owner_update" ON public.grossiste_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "grossiste_profiles_admin_all" ON public.grossiste_profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "grossiste_profiles_public_storefront" ON public.grossiste_profiles
  FOR SELECT TO anon, authenticated
  USING (enable_b2c_storefront = true AND verification_status = 'verified');

CREATE TRIGGER trg_grossiste_profiles_updated
  BEFORE UPDATE ON public.grossiste_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- grossiste_earnings
CREATE TABLE IF NOT EXISTS public.grossiste_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grossiste_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID, order_item_id UUID,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  settlement_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grossiste_earnings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_grossiste_earnings_user ON public.grossiste_earnings(grossiste_user_id);
CREATE INDEX IF NOT EXISTS idx_grossiste_earnings_status ON public.grossiste_earnings(status);
CREATE INDEX IF NOT EXISTS idx_grossiste_earnings_settlement ON public.grossiste_earnings(settlement_id);

CREATE POLICY "grossiste_earnings_owner_read" ON public.grossiste_earnings
  FOR SELECT TO authenticated USING (grossiste_user_id = auth.uid());
CREATE POLICY "grossiste_earnings_admin_all" ON public.grossiste_earnings
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- grossiste_settlements
CREATE TABLE IF NOT EXISTS public.grossiste_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grossiste_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL, period_end DATE NOT NULL,
  gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at TIMESTAMPTZ, payment_reference TEXT, payment_method TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grossiste_settlements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_grossiste_settlements_user ON public.grossiste_settlements(grossiste_user_id);
CREATE INDEX IF NOT EXISTS idx_grossiste_settlements_status ON public.grossiste_settlements(status);

CREATE POLICY "grossiste_settlements_owner_read" ON public.grossiste_settlements
  FOR SELECT TO authenticated USING (grossiste_user_id = auth.uid());
CREATE POLICY "grossiste_settlements_admin_all" ON public.grossiste_settlements
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_grossiste_settlements_updated
  BEFORE UPDATE ON public.grossiste_settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS products: grossistes manage own
DROP POLICY IF EXISTS "Grossistes can manage own products" ON public.products;
CREATE POLICY "Grossistes can manage own products" ON public.products
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND is_grossiste(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND is_grossiste(auth.uid()));

-- Trigger: crear perfil al asignar rol
CREATE OR REPLACE FUNCTION public.create_grossiste_profile_on_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email TEXT; v_full_name TEXT;
BEGIN
  IF NEW.role = 'grossiste' THEN
    SELECT email, COALESCE(full_name, email) INTO v_email, v_full_name
    FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.grossiste_profiles (user_id, business_name, email)
    VALUES (NEW.user_id, COALESCE(v_full_name, 'Mayorista'), v_email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_create_grossiste_profile ON public.user_roles;
CREATE TRIGGER trg_create_grossiste_profile
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.create_grossiste_profile_on_role();

-- Trigger: earnings al pagar pedido B2B
CREATE OR REPLACE FUNCTION public.generate_grossiste_earnings_on_paid_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD; v_rate NUMERIC(5,2); v_gross NUMERIC(12,2); v_comm NUMERIC(12,2); v_net NUMERIC(12,2);
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    FOR r IN
      SELECT oi.id AS order_item_id, oi.product_id, oi.quantity, oi.unit_price,
             p.owner_user_id, gp.commission_rate
      FROM public.order_items_b2b oi
      JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.grossiste_profiles gp ON gp.user_id = p.owner_user_id
      WHERE oi.order_id = NEW.id AND p.owner_user_id IS NOT NULL AND p.owner_role = 'grossiste'
    LOOP
      v_gross := COALESCE(r.unit_price,0) * COALESCE(r.quantity,0);
      v_rate := COALESCE(r.commission_rate, 10.00);
      v_comm := ROUND(v_gross * v_rate / 100.0, 2);
      v_net := v_gross - v_comm;
      INSERT INTO public.grossiste_earnings (
        grossiste_user_id, order_id, order_item_id, product_id,
        gross_amount, commission_rate, commission_amount, net_amount, status
      ) VALUES (
        r.owner_user_id, NEW.id, r.order_item_id, r.product_id,
        v_gross, v_rate, v_comm, v_net, 'pending'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_grossiste_earnings_on_paid ON public.orders_b2b;
CREATE TRIGGER trg_grossiste_earnings_on_paid
  AFTER UPDATE OF status ON public.orders_b2b
  FOR EACH ROW EXECUTE FUNCTION public.generate_grossiste_earnings_on_paid_order();

-- Vista v_productos_con_precio_b2b
CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id, p.sku_interno, p.nombre, p.descripcion_corta, p.descripcion_larga,
  p.costo_base_excel AS costo_base, p.precio_mayorista_base,
  ( SELECT bmr.margin_percent FROM b2b_margin_ranges bmr
    WHERE bmr.is_active = true AND p.costo_base_excel >= bmr.min_cost
      AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
    ORDER BY bmr.sort_order LIMIT 1) AS applied_margin_percent,
  ( SELECT round(p.costo_base_excel * (1 + bmr.margin_percent / 100.0) * 1.12, 2)
    FROM b2b_margin_ranges bmr
    WHERE bmr.is_active = true AND p.costo_base_excel IS NOT NULL AND p.costo_base_excel > 0
      AND p.costo_base_excel >= bmr.min_cost
      AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
    ORDER BY bmr.sort_order LIMIT 1) AS precio_b2b,
  ( SELECT round(p.costo_base_excel * bmr.margin_percent / 100.0, 2) FROM b2b_margin_ranges bmr
    WHERE bmr.is_active = true AND p.costo_base_excel >= bmr.min_cost
      AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
    ORDER BY bmr.sort_order LIMIT 1) AS margin_value,
  ( SELECT round(p.costo_base_excel * (1 + bmr.margin_percent / 100.0) * 0.12, 2) FROM b2b_margin_ranges bmr
    WHERE bmr.is_active = true AND p.costo_base_excel >= bmr.min_cost
      AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
    ORDER BY bmr.sort_order LIMIT 1) AS platform_fee,
  p.precio_sugerido_venta, p.precio_promocional, p.promo_active,
  p.promo_starts_at, p.promo_ends_at, p.moq, p.stock_fisico, p.stock_status,
  p.imagen_principal, p.galeria_imagenes, p.categoria_id, p.proveedor_id,
  p.origin_country_id, p.currency_code, p.url_origen,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g::numeric / 1000.0, 0) AS peso_kg,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g::numeric / 1000.0, 0) AS weight_kg,
  p.dimensiones_cm, p.length_cm, p.width_cm, p.height_cm,
  p.is_oversize, p.shipping_mode, p.is_active, p.is_parent,
  p.created_at, p.updated_at, p.last_calculated_at,
  p.owner_user_id, p.owner_role, p.approval_status,
  gp.business_name AS owner_business_name,
  gp.logo_url AS owner_logo_url,
  gp.verification_status AS owner_verification_status
FROM products p
LEFT JOIN grossiste_profiles gp ON gp.user_id = p.owner_user_id
WHERE p.is_active = true
  AND (p.approval_status = 'approved' OR p.owner_role = 'admin' OR p.owner_user_id IS NULL);
