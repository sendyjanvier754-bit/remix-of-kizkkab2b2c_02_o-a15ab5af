-- =====================================================
-- FUNCIÓN PARA QUE ADMINS CONFIRMEN PAGOS
-- =====================================================
-- Permite a un admin confirmar el pago de un pedido B2B
-- Una vez confirmado, el pedido aparecerá en el inventario del comprador
-- =====================================================

CREATE OR REPLACE FUNCTION admin_confirm_payment(
  p_order_id UUID,
  p_admin_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
BEGIN
  -- Verificar que la orden existe y está en estado 'paid'
  SELECT 
    id,
    order_number,
    status,
    payment_verified_by,
    buyer_id,
    total_amount
  INTO v_order
  FROM orders_b2b
  WHERE id = p_order_id;
  
  -- Validaciones
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Orden no encontrada',
      'code', 'ORDER_NOT_FOUND'
    );
  END IF;
  
  IF v_order.status != 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La orden no está en estado "paid"',
      'code', 'INVALID_STATUS',
      'current_status', v_order.status
    );
  END IF;
  
  IF v_order.payment_verified_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya fue confirmado anteriormente',
      'code', 'ALREADY_CONFIRMED',
      'confirmed_by', v_order.payment_verified_by
    );
  END IF;
  
  -- Confirmar el pago
  UPDATE orders_b2b
  SET 
    payment_verified_by = p_admin_user_id,
    payment_verified_at = now(),
    confirmed_at = now(),
    internal_notes = CASE 
      WHEN internal_notes IS NULL THEN p_notes
      ELSE internal_notes || E'\n' || '--- Pago confirmado por admin ---' || E'\n' || COALESCE(p_notes, '')
    END
  WHERE id = p_order_id;
  
  -- El trigger auto_add_to_seller_catalog_on_complete se activará automáticamente
  -- y agregará los productos al inventario del comprador
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pago confirmado correctamente',
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'buyer_id', v_order.buyer_id,
    'confirmed_by', p_admin_user_id,
    'confirmed_at', now(),
    'note', 'Los productos se agregarán automáticamente al inventario B2C del comprador'
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION admin_confirm_payment IS 
  'Permite a un admin confirmar el pago de un pedido B2B.
  Una vez confirmado, el trigger agregará automáticamente los productos
  al inventario B2C del comprador con status "Disponible pronto"';

-- Ejemplo de uso para admins
SELECT '
💡 EJEMPLO DE USO PARA ADMINS:

-- Confirmar un pago
SELECT admin_confirm_payment(
  p_order_id := ''uuid-del-pedido'',
  p_admin_user_id := auth.uid(), -- ID del admin actual
  p_notes := ''Pago verificado mediante transferencia bancaria''
);

-- Ver resultado:
{
  "success": true,
  "message": "Pago confirmado correctamente",
  "order_id": "...",
  "order_number": "ORD-12345",
  "buyer_id": "...",
  "confirmed_by": "...",
  "confirmed_at": "2026-02-28T...",
  "note": "Los productos se agregarán automáticamente al inventario B2C del comprador"
}
' as ejemplo;

-- Query para que admins vean pedidos pendientes de confirmar
SELECT '
📋 VER PEDIDOS PENDIENTES DE CONFIRMAR:

SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.payment_method,
  o.payment_reference,
  u.email as buyer_email,
  s.name as buyer_store,
  o.paid_at,
  COUNT(oi.id) as total_items
FROM orders_b2b o
LEFT JOIN users u ON u.id = o.buyer_id
LEFT JOIN stores s ON s.owner_user_id = o.buyer_id
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.status = ''paid''
  AND o.payment_verified_by IS NULL
GROUP BY o.id, o.order_number, o.status, o.total_amount, 
         o.payment_method, o.payment_reference, u.email, s.name, o.paid_at
ORDER BY o.paid_at DESC;
' as query_pendientes;

SELECT '✅ Función de confirmación de admin creada' as resultado;
