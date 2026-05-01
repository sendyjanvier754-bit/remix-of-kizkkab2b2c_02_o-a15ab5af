-- 2. PARTNER APPLICATIONS
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_type TEXT NOT NULL CHECK (application_type IN ('pickup_point','driver')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  national_id TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  commune_id UUID REFERENCES public.communes(id) ON DELETE SET NULL,
  address TEXT,
  business_name TEXT,
  business_hours JSONB,
  estimated_capacity INTEGER,
  has_storage_space BOOLEAN,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  vehicle_capacity_kg NUMERIC,
  license_number TEXT,
  coverage_department_ids UUID[],
  documents JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approved_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tracking_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invitation_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON public.partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_apps_type ON public.partner_applications(application_type);
CREATE INDEX IF NOT EXISTS idx_partner_apps_email ON public.partner_applications(email);
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit application" ON public.partner_applications
  FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "Applicant or admin view application" ON public.partner_applications
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() IS NOT NULL AND email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
    OR approved_user_id = auth.uid()
  );
CREATE POLICY "Admin updates applications" ON public.partner_applications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes applications" ON public.partner_applications
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 3. DRIVERS
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.partner_applications(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_plate TEXT,
  vehicle_capacity_kg NUMERIC,
  license_number TEXT,
  coverage_department_ids UUID[] DEFAULT '{}',
  current_status TEXT NOT NULL DEFAULT 'offline' CHECK (current_status IN ('available','on_route','offline')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_completed_routes INTEGER DEFAULT 0,
  total_earnings_usd NUMERIC(12,2) DEFAULT 0,
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_location_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(current_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.drivers(user_id);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers view own" ON public.drivers FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers update own" ON public.drivers FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin inserts drivers" ON public.drivers FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes drivers" ON public.drivers FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. PICKUP POINT MANAGERS
CREATE TABLE IF NOT EXISTS public.pickup_point_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_point_id UUID NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.partner_applications(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner','staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pickup_point_id)
);
CREATE INDEX IF NOT EXISTS idx_ppm_user ON public.pickup_point_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_ppm_point ON public.pickup_point_managers(pickup_point_id);
ALTER TABLE public.pickup_point_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager sees own" ON public.pickup_point_managers FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages managers" ON public.pickup_point_managers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. DELIVERY ROUTES
CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_code TEXT UNIQUE NOT NULL DEFAULT ('RT-' || upper(substring(encode(gen_random_bytes(4), 'hex'), 1, 8))),
  name TEXT NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('hub_to_point','point_to_customer','hub_to_customer','inter_hub')),
  origin_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  destination_department_ids UUID[] DEFAULT '{}',
  fee_type TEXT NOT NULL DEFAULT 'fixed' CHECK (fee_type IN ('fixed','percent')),
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  completion_bonus NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('draft','available','accepted','in_progress','completed','cancelled')),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  total_distance_km NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.delivery_routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_driver ON public.delivery_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_origin_dept ON public.delivery_routes(origin_department_id);
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver sees available + own routes" ON public.delivery_routes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (status = 'available' AND public.has_role(auth.uid(), 'driver_partner'))
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin manages routes" ON public.delivery_routes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Driver updates own route" ON public.delivery_routes FOR UPDATE
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- 6. ROUTE STOPS
CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('hub_pickup','pickup_point_drop','pickup_point_pickup','customer_drop')),
  pickup_point_id UUID REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  hub_id UUID REFERENCES public.transit_hubs(id) ON DELETE SET NULL,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  order_id UUID,
  order_type TEXT CHECK (order_type IN ('b2c','b2b')),
  package_count INTEGER DEFAULT 1,
  estimated_weight_kg NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','arrived','completed','failed','skipped')),
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  proof_url TEXT,
  proof_signature TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stops_route ON public.route_stops(route_id, sequence);
CREATE INDEX IF NOT EXISTS idx_stops_order ON public.route_stops(order_id);
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stops follow route visibility" ON public.route_stops FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR route_id IN (
      SELECT r.id FROM public.delivery_routes r
      LEFT JOIN public.drivers d ON d.id = r.driver_id
      WHERE d.user_id = auth.uid()
        OR (r.status = 'available' AND public.has_role(auth.uid(), 'driver_partner'))
    )
  );
CREATE POLICY "Admin manages stops" ON public.route_stops FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Driver updates own stops" ON public.route_stops FOR UPDATE
  USING (
    route_id IN (
      SELECT r.id FROM public.delivery_routes r
      JOIN public.drivers d ON d.id = r.driver_id
      WHERE d.user_id = auth.uid()
    )
  );

-- 7. PARTNER EARNINGS
CREATE TABLE IF NOT EXISTS public.partner_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('pickup_partner','driver_partner')),
  source_type TEXT NOT NULL CHECK (source_type IN ('route_completed','route_bonus','package_received','daily_storage','manual_adjustment')),
  route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  pickup_point_id UUID REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  order_delivery_id UUID REFERENCES public.order_deliveries(id) ON DELETE SET NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_partner ON public.partner_earnings(partner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_earnings_route ON public.partner_earnings(route_id);
ALTER TABLE public.partner_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partner sees own earnings" ON public.partner_earnings FOR SELECT
  USING (partner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages earnings" ON public.partner_earnings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. PARTNER CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.partner_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL CHECK (context_type IN ('order','route','application')),
  context_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pchat_ctx ON public.partner_chat_messages(context_type, context_id);
ALTER TABLE public.partner_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read chat" ON public.partner_chat_messages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR sender_id = auth.uid()
    OR (context_type = 'route' AND context_id IN (
      SELECT r.id FROM public.delivery_routes r
      JOIN public.drivers d ON d.id = r.driver_id
      WHERE d.user_id = auth.uid()
    ))
  );
CREATE POLICY "Authenticated send chat" ON public.partner_chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- 9. PICKUP POINTS extender
ALTER TABLE public.pickup_points
  ADD COLUMN IF NOT EXISTS commission_per_package NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_per_day_storage NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.partner_applications(id) ON DELETE SET NULL;

-- 10. ORDERS B2C extender
ALTER TABLE public.orders_b2c
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'pickup_point' CHECK (delivery_method IN ('pickup_point','home_delivery'));
CREATE INDEX IF NOT EXISTS idx_orders_b2c_pickup_point ON public.orders_b2c(pickup_point_id);

-- 11a. SUBMIT APPLICATION
CREATE OR REPLACE FUNCTION public.submit_partner_application(
  p_application_type TEXT, p_full_name TEXT, p_email TEXT, p_phone TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE(application_id UUID, tracking_token TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_token TEXT;
BEGIN
  IF p_application_type NOT IN ('pickup_point','driver') THEN
    RAISE EXCEPTION 'Tipo de aplicación inválido';
  END IF;
  INSERT INTO public.partner_applications (
    application_type, full_name, email, phone, national_id,
    department_id, commune_id, address,
    business_name, business_hours, estimated_capacity, has_storage_space,
    vehicle_type, vehicle_plate, vehicle_capacity_kg, license_number, coverage_department_ids,
    documents, photo_url, notes
  ) VALUES (
    p_application_type, p_full_name, p_email, p_phone, p_data->>'national_id',
    NULLIF(p_data->>'department_id','')::UUID, NULLIF(p_data->>'commune_id','')::UUID,
    p_data->>'address', p_data->>'business_name',
    COALESCE(p_data->'business_hours', '{}'::jsonb),
    NULLIF(p_data->>'estimated_capacity','')::INTEGER,
    COALESCE((p_data->>'has_storage_space')::BOOLEAN, false),
    p_data->>'vehicle_type', p_data->>'vehicle_plate',
    NULLIF(p_data->>'vehicle_capacity_kg','')::NUMERIC,
    p_data->>'license_number',
    CASE WHEN p_data ? 'coverage_department_ids'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'coverage_department_ids'))::UUID[]
      ELSE '{}'::UUID[] END,
    COALESCE(p_data->'documents', '[]'::jsonb),
    p_data->>'photo_url', p_data->>'notes'
  )
  RETURNING id, partner_applications.tracking_token INTO v_id, v_token;
  RETURN QUERY SELECT v_id, v_token;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_partner_application(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- 11b. APPROVE APPLICATION
CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_application_id UUID, p_approved_user_id UUID, p_pickup_point_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.partner_applications%ROWTYPE;
  v_role public.app_role;
  v_driver_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede aprobar';
  END IF;
  SELECT * INTO v_app FROM public.partner_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'Solicitud no pendiente'; END IF;

  v_role := CASE v_app.application_type
    WHEN 'driver' THEN 'driver_partner'::public.app_role
    WHEN 'pickup_point' THEN 'pickup_partner'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_approved_user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_app.application_type = 'driver' THEN
    INSERT INTO public.drivers (
      user_id, application_id, full_name, phone, vehicle_type, vehicle_plate,
      vehicle_capacity_kg, license_number, coverage_department_ids
    ) VALUES (
      p_approved_user_id, v_app.id, v_app.full_name, v_app.phone,
      COALESCE(v_app.vehicle_type, 'unspecified'),
      v_app.vehicle_plate, v_app.vehicle_capacity_kg, v_app.license_number,
      COALESCE(v_app.coverage_department_ids, '{}')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      application_id = EXCLUDED.application_id,
      vehicle_type = EXCLUDED.vehicle_type,
      coverage_department_ids = EXCLUDED.coverage_department_ids,
      is_active = true
    RETURNING id INTO v_driver_id;
  ELSE
    IF p_pickup_point_id IS NULL THEN
      INSERT INTO public.pickup_points (
        name, address, city, country, commune_id, phone, application_id, is_active
      ) VALUES (
        COALESCE(v_app.business_name, v_app.full_name),
        COALESCE(v_app.address, ''),
        COALESCE((SELECT name FROM public.communes WHERE id = v_app.commune_id), ''),
        'HT', v_app.commune_id, v_app.phone, v_app.id, true
      )
      RETURNING id INTO p_pickup_point_id;
    END IF;
    INSERT INTO public.pickup_point_managers (user_id, pickup_point_id, application_id, role)
    VALUES (p_approved_user_id, p_pickup_point_id, v_app.id, 'owner')
    ON CONFLICT (user_id, pickup_point_id) DO UPDATE SET is_active = true;
  END IF;

  UPDATE public.partner_applications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      approved_user_id = p_approved_user_id, updated_at = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true, 'application_id', p_application_id,
    'role_granted', v_role, 'driver_id', v_driver_id, 'pickup_point_id', p_pickup_point_id
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID, UUID, UUID) TO authenticated;

-- 11c. REJECT
CREATE OR REPLACE FUNCTION public.reject_partner_application(p_application_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede rechazar';
  END IF;
  UPDATE public.partner_applications
  SET status = 'rejected', rejection_reason = p_reason,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_application_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no pendiente o no encontrada'; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_partner_application(UUID, TEXT) TO authenticated;

-- 11d. ACCEPT ROUTE
CREATE OR REPLACE FUNCTION public.accept_delivery_route(p_route_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver_id UUID; v_route public.delivery_routes%ROWTYPE;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid() AND is_active = true;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'No eres conductor activo'; END IF;
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ruta no encontrada'; END IF;
  IF v_route.status <> 'available' OR v_route.driver_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ruta ya no disponible';
  END IF;
  UPDATE public.delivery_routes
  SET driver_id = v_driver_id, status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = p_route_id;
  UPDATE public.drivers SET current_status = 'on_route', updated_at = now() WHERE id = v_driver_id;
  RETURN jsonb_build_object('success', true, 'route_id', p_route_id, 'driver_id', v_driver_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_delivery_route(UUID) TO authenticated;

-- 11e. COMPLETE ROUTE STOP
CREATE OR REPLACE FUNCTION public.complete_route_stop(
  p_stop_id UUID, p_proof_url TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stop public.route_stops%ROWTYPE;
  v_route public.delivery_routes%ROWTYPE;
  v_driver_user UUID;
  v_total INTEGER; v_done INTEGER;
  v_earning_amount NUMERIC;
BEGIN
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parada no encontrada'; END IF;
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = v_stop.route_id FOR UPDATE;
  SELECT user_id INTO v_driver_user FROM public.drivers WHERE id = v_route.driver_id;
  IF v_driver_user <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.route_stops
  SET status = 'completed', completed_at = now(),
      proof_url = COALESCE(p_proof_url, proof_url),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_stop_id;
  IF v_route.status = 'accepted' THEN
    UPDATE public.delivery_routes SET status = 'in_progress', started_at = now() WHERE id = v_route.id;
  END IF;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total, v_done FROM public.route_stops WHERE route_id = v_route.id;
  UPDATE public.delivery_routes SET completed_stops = v_done, total_stops = v_total WHERE id = v_route.id;
  IF v_done >= v_total AND v_total > 0 THEN
    UPDATE public.delivery_routes SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_route.id;
    UPDATE public.drivers
    SET current_status = 'available',
        total_completed_routes = total_completed_routes + 1,
        total_earnings_usd = total_earnings_usd + v_route.fee_amount + COALESCE(v_route.completion_bonus, 0),
        updated_at = now()
    WHERE id = v_route.driver_id;
    v_earning_amount := v_route.fee_amount + COALESCE(v_route.completion_bonus, 0);
    INSERT INTO public.partner_earnings (
      partner_user_id, partner_type, source_type, route_id, amount_usd, description
    ) VALUES (
      v_driver_user, 'driver_partner', 'route_completed', v_route.id, v_earning_amount,
      'Ruta ' || v_route.route_code || ' completada (' || v_total || ' paradas)'
    );
  END IF;
  RETURN jsonb_build_object('success', true, 'completed', v_done, 'total', v_total);
END; $$;
GRANT EXECUTE ON FUNCTION public.complete_route_stop(UUID, TEXT, TEXT) TO authenticated;

-- 12. TRIGGERS updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_partner_apps_updated ON public.partner_applications;
CREATE TRIGGER trg_partner_apps_updated BEFORE UPDATE ON public.partner_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_drivers_updated ON public.drivers;
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_routes_updated ON public.delivery_routes;
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON public.delivery_routes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 13. REALTIME
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_routes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.route_stops; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_applications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;