-- Persist deferred seller onboarding and create deduplicated reminders.
ALTER TABLE public.seller_onboarding_progress
  ADD COLUMN IF NOT EXISTS postponed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.maybe_create_seller_onboarding_reminder()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress seller_onboarding_progress%ROWTYPE;
  v_notification_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_progress
  FROM seller_onboarding_progress
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_progress.is_complete IS TRUE
    OR COALESCE(v_progress.postponed_at, v_progress.created_at, now()) > now() - INTERVAL '5 days'
     OR (v_progress.last_reminder_at IS NOT NULL
         AND v_progress.last_reminder_at > now() - INTERVAL '3 days') THEN
    RETURN jsonb_build_object('created', false);
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_user_id,
    'system',
    'Completa tu registro de vendedor',
    'Tu cuenta de vendedor está parcialmente configurada. Continúa donde lo dejaste; tus documentos de identidad siguen pendientes.',
    jsonb_build_object(
      'action_url', '/seller/cuenta',
      'kind', 'seller_onboarding_reminder',
      'title_key', 'sellerRegistration.continueLater',
      'message_key', 'sellerRegistration.draftSaved'
    )
  )
  RETURNING id INTO v_notification_id;

  UPDATE seller_onboarding_progress
  SET last_reminder_at = now(), updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('created', true, 'notification_id', v_notification_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_create_seller_onboarding_reminder() TO authenticated;