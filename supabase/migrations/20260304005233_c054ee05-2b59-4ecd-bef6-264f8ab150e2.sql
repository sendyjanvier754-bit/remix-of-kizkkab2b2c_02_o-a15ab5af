DROP FUNCTION IF EXISTS public.admin_confirm_payment(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.admin_confirm_payment(
  p_order_id UUID,
  p_admin_user_id UUID,
  p_payment_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user is not an admin';
  END IF;

  SELECT * INTO v_order FROM orders_b2b WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders_b2b SET
    payment_status = 'paid',
    status = 'paid',
    payment_confirmed_at = now(),
    payment_verified_by = p_admin_user_id,
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_confirmed_by', p_admin_user_id::text,
      'payment_confirmation_notes', COALESCE(p_payment_notes, '')
    )
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'paid');
END;
$$;

ALTER FUNCTION public.auto_add_to_seller_catalog_on_complete() SET search_path = public;
ALTER FUNCTION public.link_order_to_market_po_on_payment() SET search_path = public;