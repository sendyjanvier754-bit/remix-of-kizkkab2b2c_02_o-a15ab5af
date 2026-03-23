
-- ============================================================================
-- FIX: delete_product_cascade - corregir tablas y columnas reales
-- ============================================================================
-- Flujo:
--   p_action = 'check'        → Solo verificar si hay pedidos pendientes
--   p_action = 'delete_keep'  → Soft delete producto, mantener pedidos pendientes
--   p_action = 'delete_cancel'→ Cancelar pedidos + reembolsos + eliminar producto
--   p_action = 'delete'       → Eliminar producto (sin pedidos pendientes)
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_product_cascade(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.delete_product_cascade(
  p_product_id UUID,
  p_delete_reason TEXT DEFAULT 'Producto descontinuado',
  p_action TEXT DEFAULT 'check'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_pending_b2b INT := 0;
  v_pending_b2c INT := 0;
  v_variants_deleted INT := 0;
  v_refunds_created INT := 0;
  v_images_to_cleanup TEXT[] := '{}';
  v_order RECORD;
BEGIN
  -- 1. Verificar que el producto existe
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;

  -- 2. Contar pedidos pendientes
  SELECT COUNT(DISTINCT ob.id) INTO v_pending_b2b
  FROM orders_b2b ob
  INNER JOIN order_items_b2b oib ON oib.order_id = ob.id
  WHERE oib.product_id = p_product_id
    AND ob.status IN ('pending', 'confirmed', 'in_po', 'processing', 'preparing');

  SELECT COUNT(DISTINCT oc.id) INTO v_pending_b2c
  FROM orders_b2c oc
  INNER JOIN order_items_b2c oic ON oic.order_id = oc.id
  WHERE oic.product_id = p_product_id
    AND oc.status IN ('pending', 'confirmed', 'processing');

  -- 3. Si solo estamos verificando, retornar info
  IF p_action = 'check' THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'check',
      'product_name', v_product.nombre,
      'pending_orders_b2b', v_pending_b2b,
      'pending_orders_b2c', v_pending_b2c,
      'total_pending', v_pending_b2b + v_pending_b2c
    );
  END IF;

  -- 4. ACCIÓN: delete_keep → Soft delete (desactivar), mantener pedidos
  IF p_action = 'delete_keep' THEN
    UPDATE products 
    SET is_active = FALSE, updated_at = now()
    WHERE id = p_product_id;

    -- Quitar de carritos activos
    DELETE FROM b2b_cart_items WHERE product_id = p_product_id;
    DELETE FROM b2c_cart_items WHERE seller_catalog_id IN (
      SELECT id FROM seller_catalog WHERE product_id = p_product_id
    );

    -- Quitar de favoritos
    DELETE FROM b2b_favorites WHERE product_id = p_product_id;
    DELETE FROM b2c_favorites WHERE product_id = p_product_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'discontinued',
      'product_id', p_product_id,
      'product_name', v_product.nombre,
      'message', 'Producto desactivado. Los pedidos pendientes continuarán su flujo normal. El producto será eliminado completamente cuando todos los pedidos se completen.',
      'pending_orders', v_pending_b2b + v_pending_b2c
    );
  END IF;

  -- 5. ACCIÓN: delete_cancel → Cancelar pedidos + reembolsos + eliminar
  IF p_action = 'delete_cancel' OR p_action = 'delete' THEN

    -- Cancelar pedidos B2B pendientes y crear reembolsos
    FOR v_order IN 
      SELECT DISTINCT ob.id as order_id, ob.buyer_id, ob.total_amount
      FROM orders_b2b ob
      INNER JOIN order_items_b2b oib ON oib.order_id = ob.id
      WHERE oib.product_id = p_product_id
        AND ob.status IN ('pending', 'confirmed', 'in_po', 'processing', 'preparing')
    LOOP
      UPDATE orders_b2b 
      SET status = 'cancelled', updated_at = now(),
          admin_notes = COALESCE(admin_notes, '') || E'\n[AUTO] Cancelado por eliminación de producto: ' || p_delete_reason
      WHERE id = v_order.order_id;

      -- Crear reembolso si hay monto
      IF v_order.total_amount IS NOT NULL AND v_order.total_amount > 0 AND v_order.buyer_id IS NOT NULL THEN
        INSERT INTO refund_requests (order_id, buyer_user_id, amount, reason, status, request_type, notes)
        VALUES (
          v_order.order_id,
          v_order.buyer_id,
          v_order.total_amount,
          format('Reembolso automático - Producto eliminado: %s', v_product.nombre),
          'pending',
          'automatic',
          format('Generado al eliminar producto %s. Razón: %s', v_product.nombre, p_delete_reason)
        );
        v_refunds_created := v_refunds_created + 1;
      END IF;

      v_pending_b2b := v_pending_b2b; -- already counted
    END LOOP;

    -- Cancelar pedidos B2C pendientes y crear reembolsos
    FOR v_order IN 
      SELECT DISTINCT oc.id as order_id, oc.buyer_user_id, oc.total_amount
      FROM orders_b2c oc
      INNER JOIN order_items_b2c oic ON oic.order_id = oc.id
      WHERE oic.product_id = p_product_id
        AND oc.status IN ('pending', 'confirmed', 'processing')
    LOOP
      UPDATE orders_b2c
      SET status = 'cancelled', updated_at = now(),
          notes = COALESCE(notes, '') || E'\n[AUTO] Cancelado por eliminación de producto: ' || p_delete_reason
      WHERE id = v_order.order_id;

      IF v_order.total_amount IS NOT NULL AND v_order.total_amount > 0 THEN
        INSERT INTO refund_requests (order_id, buyer_user_id, amount, reason, status, request_type, notes)
        VALUES (
          v_order.order_id,
          v_order.buyer_user_id,
          v_order.total_amount,
          format('Reembolso automático - Producto eliminado: %s', v_product.nombre),
          'pending',
          'automatic',
          format('Generado al eliminar producto %s. Razón: %s', v_product.nombre, p_delete_reason)
        );
        v_refunds_created := v_refunds_created + 1;
      END IF;
    END LOOP;

    -- Recolectar imágenes
    IF v_product.imagen_principal IS NOT NULL THEN
      v_images_to_cleanup := array_append(v_images_to_cleanup, v_product.imagen_principal);
    END IF;
    IF v_product.galeria_imagenes IS NOT NULL THEN
      v_images_to_cleanup := v_images_to_cleanup || v_product.galeria_imagenes;
    END IF;

    -- Eliminar dependencias
    DELETE FROM variant_attribute_values WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = p_product_id);
    
    WITH dv AS (DELETE FROM product_variants WHERE product_id = p_product_id RETURNING id)
    SELECT COUNT(*) INTO v_variants_deleted FROM dv;

    DELETE FROM product_markets WHERE product_id = p_product_id;
    DELETE FROM product_reviews WHERE product_id = p_product_id;
    DELETE FROM product_shipping_classes WHERE product_id = p_product_id;
    DELETE FROM b2b_cart_items WHERE product_id = p_product_id;
    DELETE FROM b2b_favorites WHERE product_id = p_product_id;
    DELETE FROM b2c_favorites WHERE product_id = p_product_id;

    -- Registrar imágenes para limpieza
    IF array_length(v_images_to_cleanup, 1) > 0 THEN
      INSERT INTO deleted_product_images (product_id, product_name, image_urls)
      VALUES (p_product_id, v_product.nombre, v_images_to_cleanup)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Eliminar producto
    DELETE FROM products WHERE id = p_product_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'deleted',
      'product_id', p_product_id,
      'product_name', v_product.nombre,
      'variants_deleted', v_variants_deleted,
      'orders_cancelled', v_pending_b2b + v_pending_b2c,
      'refunds_created', v_refunds_created,
      'images_marked_for_cleanup', COALESCE(array_length(v_images_to_cleanup, 1), 0)
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Acción no reconocida: ' || p_action);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_product_cascade(UUID, TEXT, TEXT) TO authenticated;
