CREATE OR REPLACE FUNCTION public.upgrade_to_grossiste(
  p_business_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_existing_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_business_name IS NULL OR length(trim(p_business_name)) < 2 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  -- Insert grossiste role if not present (the trigger create_grossiste_profile_on_role
  -- will auto-create the grossiste_profiles row)
  SELECT role INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'grossiste'::app_role
  LIMIT 1;

  IF v_existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'grossiste'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Update business_name + description on the (now existing) profile
  UPDATE public.grossiste_profiles
  SET business_name = trim(p_business_name),
      description = COALESCE(NULLIF(trim(p_description), ''), description),
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Safety net: if for any reason the profile didn't get created by the trigger
  INSERT INTO public.grossiste_profiles (user_id, business_name, description)
  SELECT v_user_id, trim(p_business_name), NULLIF(trim(p_description), '')
  WHERE NOT EXISTS (SELECT 1 FROM public.grossiste_profiles WHERE user_id = v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'business_name', trim(p_business_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_to_grossiste(TEXT, TEXT) TO authenticated;