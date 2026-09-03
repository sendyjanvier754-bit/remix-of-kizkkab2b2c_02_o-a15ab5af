
-- =============== RATE TEMPLATES ===============
CREATE TABLE public.pickup_rate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','segment','individual')),
  segment_key text,
  pickup_point_id uuid REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  extra_block_kg numeric NOT NULL DEFAULT 5,
  extra_block_rate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_rate_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_rate_templates TO authenticated;
GRANT ALL ON public.pickup_rate_templates TO service_role;
ALTER TABLE public.pickup_rate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rate templates" ON public.pickup_rate_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated can view active rate templates" ON public.pickup_rate_templates FOR SELECT TO authenticated USING (is_active = true);

CREATE TABLE public.pickup_rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pickup_rate_templates(id) ON DELETE CASCADE,
  min_kg numeric NOT NULL DEFAULT 0,
  max_kg numeric NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_rate_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_rate_tiers TO authenticated;
GRANT ALL ON public.pickup_rate_tiers TO service_role;
ALTER TABLE public.pickup_rate_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rate tiers" ON public.pickup_rate_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated can view rate tiers" ON public.pickup_rate_tiers FOR SELECT TO authenticated USING (true);

ALTER TABLE public.pickup_points ADD COLUMN IF NOT EXISTS segment_key text;

-- =============== EARNINGS ===============
CREATE TABLE public.pickup_point_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_point_id uuid NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  order_type text NOT NULL DEFAULT 'b2c',
  template_id uuid REFERENCES public.pickup_rate_templates(id) ON DELETE SET NULL,
  total_weight_kg numeric NOT NULL DEFAULT 0,
  base_rate numeric NOT NULL DEFAULT 0,
  extra_blocks integer NOT NULL DEFAULT 0,
  extra_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, order_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_point_earnings TO authenticated;
GRANT ALL ON public.pickup_point_earnings TO service_role;
ALTER TABLE public.pickup_point_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pickup earnings" ON public.pickup_point_earnings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pickup managers view own earnings" ON public.pickup_point_earnings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pickup_point_managers m WHERE m.pickup_point_id = pickup_point_earnings.pickup_point_id AND m.user_id = auth.uid())
);

-- =============== HUB BOXES ===============
CREATE TABLE public.hub_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_tracking_id text NOT NULL UNIQUE,
  china_tracking_id text,
  po_id uuid REFERENCES public.master_purchase_orders(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES public.po_shipments(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.shipping_routes(id) ON DELETE SET NULL,
  origin_country text,
  hub_code text,
  status text NOT NULL DEFAULT 'pending',
  total_weight_kg numeric NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  received_at timestamptz,
  received_by uuid,
  processed_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_boxes TO authenticated;
GRANT ALL ON public.hub_boxes TO service_role;
ALTER TABLE public.hub_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage hub boxes" ON public.hub_boxes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.hub_box_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES public.hub_boxes(id) ON DELETE CASCADE,
  order_id uuid,
  order_type text NOT NULL DEFAULT 'b2c',
  order_number text,
  tracking_id text,
  buyer_user_id uuid,
  buyer_name text,
  buyer_phone text,
  seller_name text,
  store_id uuid,
  sku text,
  product_name text,
  quantity integer NOT NULL DEFAULT 1,
  unit_weight_grams numeric NOT NULL DEFAULT 0,
  pickup_point_id uuid REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  shipping_address jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_box_items TO authenticated;
GRANT ALL ON public.hub_box_items TO service_role;
ALTER TABLE public.hub_box_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage hub box items" ON public.hub_box_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== TRACKING EVENTS ===============
CREATE TABLE public.package_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text NOT NULL,
  order_id uuid,
  order_type text NOT NULL DEFAULT 'b2c',
  status text NOT NULL,
  eta date,
  location text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pte_tracking ON public.package_tracking_events(tracking_id);
GRANT SELECT ON public.package_tracking_events TO anon;
GRANT SELECT, INSERT ON public.package_tracking_events TO authenticated;
GRANT ALL ON public.package_tracking_events TO service_role;
ALTER TABLE public.package_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tracking events" ON public.package_tracking_events FOR SELECT USING (true);
CREATE POLICY "Staff can add tracking events" ON public.package_tracking_events FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'pickup_partner')
  OR public.has_role(auth.uid(),'driver_partner')
);

-- =============== TRIGGERS updated_at ===============
CREATE TRIGGER trg_prt_updated BEFORE UPDATE ON public.pickup_rate_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prti_updated BEFORE UPDATE ON public.pickup_rate_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ppe_updated BEFORE UPDATE ON public.pickup_point_earnings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hb_updated BEFORE UPDATE ON public.hub_boxes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== RESOLVE TEMPLATE + COMMISSION ===============
CREATE OR REPLACE FUNCTION public.resolve_pickup_rate_template(p_pickup_point_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id FROM public.pickup_rate_templates t
  WHERE t.is_active = true AND (
    (t.scope = 'individual' AND t.pickup_point_id = p_pickup_point_id)
    OR (t.scope = 'segment' AND t.segment_key IS NOT NULL AND t.segment_key = (SELECT pp.segment_key FROM public.pickup_points pp WHERE pp.id = p_pickup_point_id))
    OR (t.scope = 'global')
  )
  ORDER BY CASE t.scope WHEN 'individual' THEN 1 WHEN 'segment' THEN 2 ELSE 3 END, t.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.calculate_pickup_commission(p_pickup_point_id uuid, p_weight_kg numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tpl RECORD; v_tier RECORD; v_max numeric; v_extra_blocks int := 0; v_base numeric := 0; v_extra numeric := 0;
BEGIN
  SELECT * INTO v_tpl FROM public.pickup_rate_templates WHERE id = public.resolve_pickup_rate_template(p_pickup_point_id);
  IF v_tpl IS NULL THEN
    RETURN jsonb_build_object('commission', 0, 'currency', 'USD', 'template_id', null, 'base_rate', 0, 'extra_blocks', 0, 'extra_amount', 0);
  END IF;
  SELECT * INTO v_tier FROM public.pickup_rate_tiers WHERE template_id = v_tpl.id AND p_weight_kg >= min_kg AND p_weight_kg <= max_kg ORDER BY min_kg LIMIT 1;
  SELECT COALESCE(MAX(max_kg),0) INTO v_max FROM public.pickup_rate_tiers WHERE template_id = v_tpl.id;
  IF v_tier IS NOT NULL THEN
    v_base := v_tier.rate;
  ELSIF p_weight_kg > v_max AND v_max > 0 THEN
    SELECT rate INTO v_base FROM public.pickup_rate_tiers WHERE template_id = v_tpl.id ORDER BY max_kg DESC LIMIT 1;
    v_extra_blocks := CEIL((p_weight_kg - v_max) / GREATEST(v_tpl.extra_block_kg, 0.001));
    v_extra := v_extra_blocks * v_tpl.extra_block_rate;
  END IF;
  RETURN jsonb_build_object(
    'commission', COALESCE(v_base,0) + v_extra,
    'currency', v_tpl.currency,
    'template_id', v_tpl.id,
    'template_name', v_tpl.name,
    'base_rate', COALESCE(v_base,0),
    'extra_blocks', v_extra_blocks,
    'extra_amount', v_extra,
    'weight_kg', p_weight_kg
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_order_weight_kg(p_order_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(oi.quantity * COALESCE(
      (SELECT COALESCE(pv.peso_g, pv.weight_g, pv.peso_kg*1000, pv.weight_kg*1000) FROM public.product_variants pv WHERE pv.sku = oi.sku LIMIT 1),
      (SELECT COALESCE(p.peso_g, p.weight_g, p.peso_kg*1000, p.weight_kg*1000) FROM public.products p WHERE p.sku_interno = oi.sku LIMIT 1),
      0)) / 1000.0, 0)
  FROM public.order_items_b2c oi WHERE oi.order_id = p_order_id;
$$;

CREATE OR REPLACE FUNCTION public.register_pickup_earning(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order RECORD; v_weight numeric; v_calc jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders_b2c WHERE id = p_order_id;
  IF v_order IS NULL OR v_order.pickup_point_id IS NULL THEN RETURN jsonb_build_object('skipped', true); END IF;
  v_weight := public.calculate_order_weight_kg(p_order_id);
  v_calc := public.calculate_pickup_commission(v_order.pickup_point_id, v_weight);
  INSERT INTO public.pickup_point_earnings (pickup_point_id, order_id, order_type, template_id, total_weight_kg, base_rate, extra_blocks, extra_amount, commission_amount, currency, breakdown)
  VALUES (v_order.pickup_point_id, p_order_id, 'b2c', NULLIF(v_calc->>'template_id','')::uuid, v_weight,
          (v_calc->>'base_rate')::numeric, (v_calc->>'extra_blocks')::int, (v_calc->>'extra_amount')::numeric,
          (v_calc->>'commission')::numeric, v_calc->>'currency', v_calc)
  ON CONFLICT (order_id, order_type) DO UPDATE SET
    total_weight_kg = EXCLUDED.total_weight_kg, base_rate = EXCLUDED.base_rate, extra_blocks = EXCLUDED.extra_blocks,
    extra_amount = EXCLUDED.extra_amount, commission_amount = EXCLUDED.commission_amount, breakdown = EXCLUDED.breakdown, updated_at = now();
  RETURN v_calc;
END;
$$;

-- Auto register when delivery becomes ready
CREATE OR REPLACE FUNCTION public.trg_register_pickup_earning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('ready','ready_for_pickup','picked_up','delivered') AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.order_type = 'b2c' THEN
    PERFORM public.register_pickup_earning(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_order_deliveries_earning AFTER UPDATE ON public.order_deliveries FOR EACH ROW EXECUTE FUNCTION public.trg_register_pickup_earning();

-- =============== TRACKING ID WITH ORDER NUMBER ===============
CREATE OR REPLACE FUNCTION public.generate_hybrid_tracking_id(p_order_id uuid)
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_order RECORD; v_po RECORD; v_address RECORD; v_sequence INTEGER; v_tracking VARCHAR;
BEGIN
  SELECT * INTO v_order FROM orders_b2b WHERE id = p_order_id;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_po FROM master_purchase_orders WHERE id = v_order.master_po_id;
  SELECT a.*, c.code as commune_code, d.code as department_code INTO v_address
  FROM addresses a LEFT JOIN communes c ON c.name = a.city LEFT JOIN departments d ON c.department_id = d.id WHERE a.id = v_order.shipping_address_id;
  SELECT COUNT(*) + 1 INTO v_sequence FROM orders_b2b WHERE master_po_id = v_order.master_po_id AND created_at < v_order.created_at;

  v_tracking := 'HT-' || COALESCE(v_order.order_number, 'NOORD') || '-' || COALESCE(v_address.department_code, 'XX') || '-' || COALESCE(v_po.po_number, 'PENDING') || '-' ||
    COALESCE(v_po.china_tracking, 'PENDING') || '-' || COALESCE(v_po.hub_code, 'MIA') || '-' || LPAD(v_sequence::TEXT, 4, '0');
  IF v_order.is_express THEN v_tracking := v_tracking || '-EXP'; END IF;
  IF v_order.is_oversize THEN v_tracking := v_tracking || '-OVZ'; END IF;
  IF v_order.is_sensitive THEN v_tracking := v_tracking || '-SEN'; END IF;

  UPDATE orders_b2b SET hybrid_tracking_id = v_tracking WHERE id = p_order_id;
  RETURN v_tracking;
END;
$function$;

-- Default global matrix
INSERT INTO public.pickup_rate_templates (name, scope, extra_block_kg, extra_block_rate, currency)
VALUES ('Matriz Global', 'global', 5, 0.50, 'USD');
INSERT INTO public.pickup_rate_tiers (template_id, min_kg, max_kg, rate, sort_order)
SELECT id, 0, 10, 1.00, 1 FROM public.pickup_rate_templates WHERE scope='global'
UNION ALL SELECT id, 10.01, 25, 2.00, 2 FROM public.pickup_rate_templates WHERE scope='global'
UNION ALL SELECT id, 25.01, 40, 3.50, 3 FROM public.pickup_rate_templates WHERE scope='global';
