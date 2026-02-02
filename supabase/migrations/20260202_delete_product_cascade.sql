-- ============================================================================
-- SISTEMA DE ELIMINACIÓN SEGURA DE PRODUCTOS
-- ============================================================================
-- Elimina producto con todas sus dependencias:
-- - Variantes y SKUs
-- - Imágenes (marca para limpieza)
-- - Cancela pedidos pendientes
-- - Genera reembolsos automáticos
-- ============================================================================

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
  v_affected_orders INT := 0;
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

  -- 2. Recolectar imágenes para limpieza
  IF v_product.imagen_principal IS NOT NULL THEN
    v_images_to_cleanup := array_append(v_images_to_cleanup, v_product.imagen_principal);
  END IF;
  
  IF v_product.galeria_imagenes IS NOT NULL THEN
    v_images_to_cleanup := v_images_to_cleanup || v_product.galeria_imagenes;
  END IF;

  -- 3. Recolectar imágenes de variantes
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

  -- 4. Buscar pedidos B2B pendientes con este producto
  FOR v_order IN 
    SELECT DISTINCT 
      ob.id as order_id,
      ob.buyer_user_id,
      ob.total_amount,
      ob.status
    FROM orders_b2b ob
    INNER JOIN order_items oi ON oi.order_id = ob.id
    WHERE oi.product_id = p_product_id
      AND ob.status IN ('pending', 'confirmed', 'in_po', 'processing')
  LOOP
    -- Cancelar la orden
    UPDATE orders_b2b 
    SET 
      status = 'cancelled',
      cancellation_reason = format('Producto %s eliminado: %s', v_product.nombre, p_delete_reason),
      cancelled_at = now()
    WHERE id = v_order.order_id;

    -- Obtener seller_id del producto si existe
    DECLARE
      v_seller_id UUID;
    BEGIN
      SELECT seller_id INTO v_seller_id
      FROM products
      WHERE id = p_product_id;
      
      -- Crear solicitud de reembolso automática con seller_id
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
      ) VALUES (
        v_order.order_id,
        v_order.buyer_user_id,
        v_order.total_amount,
        format('Reembolso automático - Producto eliminado: %s. Razón: %s', v_product.nombre, p_delete_reason),
        'pending'::refund_status_enum,
        'automatic',
        v_seller_id,
        format('Generado automáticamente al eliminar producto ID: %s', p_product_id),
        now()
      );
    END;

    v_affected_orders := v_affected_orders + 1;
    v_refunds_created := v_refunds_created + 1;
  END LOOP;

  -- 5. Eliminar links de atributos de variantes
  DELETE FROM variant_attribute_values
  WHERE variant_id IN (
    SELECT id FROM product_variants WHERE product_id = p_product_id
  );

  -- 6. Eliminar variantes
  WITH deleted_variants AS (
    DELETE FROM product_variants 
    WHERE product_id = p_product_id 
    RETURNING id
  )
  SELECT COUNT(*) INTO v_variants_deleted FROM deleted_variants;

  -- 7. Eliminar de product_markets
  DELETE FROM product_markets WHERE product_id = p_product_id;

  -- 8. Eliminar de wishlist
  DELETE FROM wishlist WHERE product_id = p_product_id;

  -- 9. Eliminar reviews
  DELETE FROM product_reviews WHERE product_id = p_product_id;

  -- 10. Eliminar de carrito
  DELETE FROM cart_items WHERE product_id = p_product_id;

  -- 11. Eliminar shipping class si existe
  DELETE FROM product_shipping_classes WHERE product_id = p_product_id;

  -- 12. Registrar en tabla de imágenes para limpieza (crear si no existe)
  CREATE TABLE IF NOT EXISTS deleted_product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID,
    product_name TEXT,
    image_urls TEXT[],
    deleted_at TIMESTAMPTZ DEFAULT now(),
    cleaned_up BOOLEAN DEFAULT false
  );

  INSERT INTO deleted_product_images (product_id, product_name, image_urls)
  VALUES (p_product_id, v_product.nombre, v_images_to_cleanup);

  -- 13. Finalmente, eliminar el producto
  DELETE FROM products WHERE id = p_product_id;

  -- 14. Construir resultado
  v_result := jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'product_name', v_product.nombre,
    'variants_deleted', v_variants_deleted,
    'orders_cancelled', v_affected_orders,
    'refunds_created', v_refunds_created,
    'images_marked_for_cleanup', array_length(v_images_to_cleanup, 1),
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
  v_failed INT := 0;
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
    'images_cleaned', v_cleaned,
    'failed', v_failed
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
  'Elimina producto con todas sus dependencias: variantes, SKUs, cancela pedidos, genera reembolsos';
COMMENT ON FUNCTION cleanup_deleted_product_images IS 
  'Marca imágenes de productos eliminados como limpiadas';
