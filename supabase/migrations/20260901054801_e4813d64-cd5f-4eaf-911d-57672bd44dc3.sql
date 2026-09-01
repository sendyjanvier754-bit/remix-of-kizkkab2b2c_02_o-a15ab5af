CREATE OR REPLACE FUNCTION public.approve_partner_application(p_application_id uuid, p_approved_user_id uuid, p_pickup_point_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      vehicle_capacity_kg, license_number, coverage_department_ids, logo_url
    ) VALUES (
      p_approved_user_id, v_app.id, v_app.full_name, v_app.phone,
      COALESCE(v_app.vehicle_type, 'unspecified'),
      v_app.vehicle_plate, v_app.vehicle_capacity_kg, v_app.license_number,
      COALESCE(v_app.coverage_department_ids, '{}'), v_app.photo_url
    )
    ON CONFLICT (user_id) DO UPDATE SET
      application_id = EXCLUDED.application_id,
      vehicle_type = EXCLUDED.vehicle_type,
      coverage_department_ids = EXCLUDED.coverage_department_ids,
      logo_url = COALESCE(EXCLUDED.logo_url, public.drivers.logo_url),
      is_active = true
    RETURNING id INTO v_driver_id;
  ELSE
    IF p_pickup_point_id IS NULL THEN
      INSERT INTO public.pickup_points (
        name, address, city, country, commune_id, phone, application_id, is_active, logo_url
      ) VALUES (
        COALESCE(v_app.business_name, v_app.full_name),
        COALESCE(v_app.address, ''),
        COALESCE((SELECT name FROM public.communes WHERE id = v_app.commune_id), ''),
        'HT', v_app.commune_id, v_app.phone, v_app.id, true, v_app.photo_url
      )
      RETURNING id INTO p_pickup_point_id;
    ELSE
      UPDATE public.pickup_points
      SET logo_url = COALESCE(logo_url, v_app.photo_url)
      WHERE id = p_pickup_point_id;
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
END; $function$;