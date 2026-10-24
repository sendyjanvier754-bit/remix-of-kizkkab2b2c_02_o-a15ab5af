CREATE OR REPLACE FUNCTION public.close_account(_user_id uuid, _force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b jsonb; caller uuid := auth.uid(); is_adm boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  is_adm := public.has_role(caller,'admin');
  IF _user_id <> caller AND NOT is_adm THEN RAISE EXCEPTION 'forbidden'; END IF;
  b := public.get_account_deletion_blockers(_user_id);
  IF NOT (_force AND is_adm) AND (coalesce((b->>'open_purchases')::int,0) > 0 OR coalesce((b->>'open_store_sales')::int,0) > 0) THEN
    RETURN jsonb_build_object('ok', false, 'blockers', b);
  END IF;
  UPDATE seller_catalog SET is_active = false WHERE seller_store_id IN (SELECT id FROM stores WHERE owner_user_id=_user_id);
  UPDATE stores SET is_active = false, is_accepting_orders = false WHERE owner_user_id=_user_id;
  UPDATE profiles SET full_name='Cuenta eliminada', phone=NULL, avatar_url=NULL, banner_url=NULL, deleted_at=now() WHERE id=_user_id;
  DELETE FROM user_roles WHERE user_id=_user_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.close_account(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_account(uuid, boolean) TO authenticated;