-- Fix v_refunds_management to stop exposing auth.users
DROP VIEW IF EXISTS public.v_refunds_management CASCADE;

CREATE VIEW public.v_refunds_management AS
SELECT 
  r.id,
  r.order_id,
  o.order_number,
  r.buyer_user_id,
  bp.email AS buyer_email,
  COALESCE(bp.full_name, bp.email) AS buyer_name,
  r.amount,
  r.approved_amount,
  r.reason,
  r.status,
  r.request_type,
  r.reviewed_by,
  rp.email AS reviewer_email,
  r.reviewed_at,
  r.rejection_reason,
  r.refund_method,
  r.refund_reference,
  r.completed_at,
  r.seller_id,
  r.notes,
  r.created_at,
  r.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'old_status', rsh.old_status,
        'new_status', rsh.new_status,
        'changed_by', rsh.changed_by,
        'changed_at', rsh.changed_at,
        'notes', rsh.notes
      ) ORDER BY rsh.changed_at DESC
    )
    FROM refund_status_history rsh
    WHERE rsh.refund_request_id = r.id
  ) AS status_history
FROM refund_requests r
LEFT JOIN orders_b2b o ON r.order_id = o.id
LEFT JOIN profiles bp ON r.buyer_user_id = bp.id
LEFT JOIN profiles rp ON r.reviewed_by = rp.id;
