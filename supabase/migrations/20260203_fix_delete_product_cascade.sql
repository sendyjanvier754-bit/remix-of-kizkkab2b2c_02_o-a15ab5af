-- ============================================================================
-- SISTEMA DE ELIMINACIÓN SEGURA DE PRODUCTOS (CORREGIDO)
-- ============================================================================
-- Elimina producto con lógica de negocio:
-- 1. Si no hay pedidos: Eliminación física directa
-- 2. Si hay pedidos sin iniciar entrega: Cancelar + Reembolso + Eliminar
-- 3. Si hay pedidos con entrega iniciada: Discontinuar (soft delete) sin eliminar
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_product_cascade(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.delete_product_cascade(
  p_product_id UUID,
  p_delete_reason TEXT DEFAULT 'Producto descontinuado'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_has_delivered_orders BOOLEAN := FALSE;
  v_pending_orders INT := 0;
  v_refunds_created INT := 0;
  v_variants_deleted INT := 0;
  v_images_to_cleanup TEXT[] := '{}';
  v_order RECORD;
  v_result JSONB;
BEGIN
  -- 1. Verificar que el producto existe
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Producto no encontrado'
    );
  END IF;

  -- 2. Verificar si hay pedidos con entrega iniciada o completada (B2B y B2C)
  SELECT EXISTS (
    SELECT 1 FROM orders_b2b ob
    INNER JOIN order_items_b2b oib ON oib.order_id = ob.id
    WHERE oib.product_id = p_product_id
      AND ob.status IN ('shipped', 'in_transit', 'delivered', 'completed')
    
    UNION ALL
    
    SELECT 1 FROM orders_b2c oc
    INNER JOIN order_items_b2c oic ON oic.order_id = oc.id
    WHERE oic.product_id = p_product_id
      AND oc.status IN ('shipped', 'in_transit', 'delivered', 'completed')
  ) INTO v_has_delivered_orders;

  -- 3. Si hay pedidos con entrega iniciada: DISCONTINUAR (no eliminar)
  IF v_has_delivered_orders THEN
    UPDATE products 
    SET 
      is_active = FALSE,
      updated_at = now()
    WHERE id = p_product_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'discontinued',
      'product_id', p_product_id,
      'product_name', v_product.nombre,
      'message', 'Producto descontinuado (tiene pedidos en entrega). Ya no será visible para nuevas compras pero no se eliminó para preservar historial de pedidos.',
      'reason', p_delete_reason
    );
  END IF;

  -- 4. CASO: No hay entregas iniciadas - Proceder con cancelación + eliminación
  
  -- Recolectar imágenes para limpieza
  IF v_product.imagen_principal IS NOT NULL THEN
    v_images_to_cleanup := array_append(v_images_to_cleanup, v_product.imagen_principal);
  END IF;
  
  IF v_product.galeria_imagenes IS NOT NULL THEN
    v_images_to_cleanup := v_images_to_cleanup || v_product.galeria_imagenes;
  END IF;

  -- Recolectar imágenes de variantes
  WITH variant_images AS (
    SELECT DISTINCT unnest(images) as img_url
    FROM product_variants
    WHERE product_id = p_product_id AND images IS NOT NULL
  )
  SELECT array_agg(img_url) INTO v_images_to_cleanup
  FROM (
    SELECT unnest(v_images_to_cleanup) as img_url
    UNION
    SELECT img_url FROM variant_images
  ) combined;

  -- 5. Cancelar pedidos B2B pendientes
  FOR v_order IN 
    SELECT DISTINCT 
      ob.id as order_id,
      ob.buyer_user_id,
      ob.total_amount,
      ob.status
    FROM orders_b2b ob
    INNER JOIN order_items_b2b oib ON oib.order_id = ob.id
    WHERE oib.product_id = p_product_id
      AND ob.status IN ('pending', 'confirmed', 'in_po', 'processing')
  LOOP
    -- Cancelar la orden
    UPDATE orders_b2b 
    SET 
      status = 'cancelled',
      cancellation_reason = format('Producto %s eliminado: %s', v_product.nombre, p_delete_reason),
      cancelled_at = now()
    WHERE id = v_order.order_id;

    -- Crear solicitud de reembolso automática
    INSERT INTO refund_requests (
      order_id,
      buyer_user_id,
      amount,
      reason,
      status,
      request_type,
      seller_id,
      notes,
      created_at
    ) 
    SELECT 
      v_order.order_id,
      v_order.buyer_user_id,
      v_order.total_amount,
      format('Reembolso automático - Producto eliminado: %s. Razón: %s', v_product.nombre, p_delete_reason),
      'pending'::refund_status_enum,
      'automatic',
      v_product.seller_id,
      format('Generado automáticamente al eliminar producto ID: %s', p_product_id),
      now()
    WHERE EXISTS (SELECT 1 FROM refund_status_enum);

    v_pending_orders := v_pending_orders + 1;
    v_refunds_created := v_refunds_created + 1;
  END LOOP;

  -- 6. Cancelar pedidos B2C pendientes
  FOR v_order IN 
    SELECT DISTINCT 
      oc.id as order_id,
      oc.buyer_user_id,
      oc.total_amount,
      oc.status
    FROM orders_b2c oc
    INNER JOIN order_items_b2c oic ON oic.order_id = oc.id
    WHERE oic.product_id = p_product_id
      AND oc.status IN ('pending', 'confirmed', 'processing')
  LOOP
    -- Cancelar la orden
    UPDATE orders_b2c
    SET 
      status = 'cancelled',
      cancellation_reason = format('Producto %s eliminado: %s', v_product.nombre, p_delete_reason),
      cancelled_at = now()
    WHERE id = v_order.order_id;

    -- Crear solicitud de reembolso automática
    INSERT INTO refund_requests (
      order_id,
      buyer_user_id,
      amount,
      reason,
      status,
      request_type,
      seller_id,
      notes,
      created_at
    ) 
    SELECT 
      v_order.order_id,
      v_order.buyer_user_id,
      v_order.total_amount,
      format('Reembolso automático - Producto eliminado: %s. Razón: %s', v_product.nombre, p_delete_reason),
      'pending'::refund_status_enum,
      'automatic',
      v_product.seller_id,
      format('Generado automáticamente al eliminar producto ID: %s', p_product_id),
      now()
    WHERE EXISTS (SELECT 1 FROM refund_status_enum);

    v_pending_orders := v_pending_orders + 1;
    v_refunds_created := v_refunds_created + 1;
  END LOOP;

  -- 7. Eliminar links de atributos de variantes
  DELETE FROM variant_attribute_values
  WHERE variant_id IN (
    SELECT id FROM product_variants WHERE product_id = p_product_id
  );

  -- 8. Eliminar variantes
  WITH deleted_variants AS (
    DELETE FROM product_variants 
    WHERE product_id = p_product_id 
    RETURNING id
  )
  SELECT COUNT(*) INTO v_variants_deleted FROM deleted_variants;

  -- 9. Eliminar de product_markets
  DELETE FROM product_markets WHERE product_id = p_product_id;

  -- 10. Eliminar de wishlist (si existe)
  DELETE FROM wishlist WHERE product_id = p_product_id;

  -- 11. Eliminar reviews
  DELETE FROM product_reviews WHERE product_id = p_product_id;

  -- 12. Eliminar de carritos B2B y B2C
  DELETE FROM b2b_cart_items WHERE product_id = p_product_id;
  DELETE FROM b2c_cart_items WHERE product_id = p_product_id;

  -- 13. Eliminar shipping class (si existe)
  DELETE FROM product_shipping_classes WHERE product_id = p_product_id;

  -- 14. Registrar imágenes para limpieza
  CREATE TABLE IF NOT EXISTS deleted_product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID,
    product_name TEXT,
    image_urls TEXT[],
    deleted_at TIMESTAMPTZ DEFAULT now(),
    cleaned_up BOOLEAN DEFAULT false
  );

  IF array_length(v_images_to_cleanup, 1) > 0 THEN
    INSERT INTO deleted_product_images (product_id, product_name, image_urls)
    VALUES (p_product_id, v_product.nombre, v_images_to_cleanup);
  END IF;

  -- 15. Finalmente, eliminar el producto
  DELETE FROM products WHERE id = p_product_id;

  -- 16. Construir resultado
  v_result := jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'product_id', p_product_id,
    'product_name', v_product.nombre,
    'variants_deleted', v_variants_deleted,
    'orders_cancelled', v_pending_orders,
    'refunds_created', v_refunds_created,
    'images_marked_for_cleanup', COALESCE(array_length(v_images_to_cleanup, 1), 0),
    'delete_reason', p_delete_reason,
    'deleted_at', now()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- FUNCIÓN: Limpiar imágenes huérfanas del storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_deleted_product_images()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned INT := 0;
  v_image RECORD;
BEGIN
  -- Marca como limpiadas (la limpieza real del storage se hace desde el cliente)
  FOR v_image IN 
    SELECT id, image_urls
    FROM deleted_product_images
    WHERE cleaned_up = false
    LIMIT 100
  LOOP
    UPDATE deleted_product_images
    SET cleaned_up = true
    WHERE id = v_image.id;
    
    v_cleaned := v_cleaned + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'images_cleaned', v_cleaned
  );
END;
$$;

-- ============================================================================
-- PERMISOS
-- ============================================================================
GRANT EXECUTE ON FUNCTION delete_product_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_deleted_product_images TO authenticated;

-- Comentarios
COMMENT ON FUNCTION delete_product_cascade IS 
  'Elimina producto o lo discontinua según estado de pedidos: (1) Sin pedidos → Eliminar, (2) Pedidos pendientes → Cancelar + Reembolso + Eliminar, (3) Pedidos en entrega → Discontinuar sin eliminar';
COMMENT ON FUNCTION cleanup_deleted_product_images IS 
  'Marca imágenes de productos eliminados como limpiadas';
