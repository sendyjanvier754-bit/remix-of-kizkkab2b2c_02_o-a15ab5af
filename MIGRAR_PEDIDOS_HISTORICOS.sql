-- =====================================================
-- MIGRACIÓN DE PEDIDOS HISTÓRICOS AL INVENTARIO B2C
-- =====================================================
-- Este script procesa todos los pedidos que ya estaban pagados
-- ANTES de implementar el sistema de confirmación de admin
-- y los agrega al inventario B2C de los compradores
-- =====================================================

-- PASO 1: Ver pedidos históricos que necesitan migración
SELECT 
  '📋 PEDIDOS HISTÓRICOS A MIGRAR' as info,
  o.id,
  o.order_number,
  o.status,
  o.buyer_id,
  o.total_amount,
  o.created_at,
  o.payment_verified_by as confirmado_por,
  COUNT(oi.id) as total_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.status IN ('paid', 'completed', 'delivered')
  AND o.payment_verified_by IS NULL  -- No fueron confirmados aún
  AND oi.variant_id IS NOT NULL  -- Tienen variant_id válido
GROUP BY o.id, o.order_number, o.status, o.buyer_id, o.total_amount, 
         o.created_at, o.payment_verified_by
ORDER BY o.created_at;

-- PASO 2: Función de migración que procesa un pedido histórico
CREATE OR REPLACE FUNCTION migrar_pedido_historico(
  p_order_id UUID,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
  v_availability_status TEXT;
  v_items_procesados INTEGER := 0;
BEGIN
  -- Obtener información del pedido
  SELECT 
    id, order_number, status, buyer_id, payment_verified_by
  INTO v_order
  FROM orders_b2b
  WHERE id = p_order_id;
  
  -- Validaciones
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Orden no encontrada'
    );
  END IF;
  
  IF v_order.status NOT IN ('paid', 'completed', 'delivered') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La orden no está pagada/completada/entregada',
      'status_actual', v_order.status
    );
  END IF;
  
  IF v_order.payment_verified_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este pedido ya fue migrado anteriormente'
    );
  END IF;
  
  -- Determinar availability_status
  IF v_order.status = 'paid' THEN
    v_availability_status := 'pending';
  ELSE
    v_availability_status := 'available';
  END IF;
  
  -- Obtener seller_store_id del comprador
  SELECT id INTO v_store_id
  FROM stores
  WHERE owner_user_id = v_order.buyer_id
  LIMIT 1;
  
  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El comprador no tiene tienda registrada'
    );
  END IF;
  
  -- Procesar cada item del pedido
  FOR v_item IN 
    SELECT 
      oi.product_id,
      oi.variant_id,
      oi.cantidad,
      oi.sku,
      p.nombre,
      p.descripcion_corta as descripcion,
      COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]) as images
    FROM order_items_b2b oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND oi.variant_id IS NOT NULL
  LOOP
    
    -- Buscar o crear registro principal del producto
    SELECT id INTO v_catalog_id
    FROM seller_catalog
    WHERE seller_store_id = v_store_id
      AND source_product_id = v_item.product_id
    LIMIT 1;
    
    IF v_catalog_id IS NULL THEN
      INSERT INTO seller_catalog (
        seller_store_id,
        source_product_id,
        sku,
        nombre,
        descripcion,
        images,
        is_active
      )
      VALUES (
        v_store_id,
        v_item.product_id,
        v_item.sku,
        v_item.nombre,
        v_item.descripcion,
        v_item.images,
        true
      )
      RETURNING id INTO v_catalog_id;
    END IF;
    
    -- Manejar la variante
    IF v_item.variant_id IS NOT NULL THEN
      
      SELECT id INTO v_existing_variant
      FROM seller_catalog_variants
      WHERE seller_catalog_id = v_catalog_id
        AND variant_id = v_item.variant_id
      LIMIT 1;
      
      IF v_existing_variant IS NOT NULL THEN
        -- Actualizar stock existente
        UPDATE seller_catalog_variants
        SET 
          stock = stock + v_item.cantidad,
          availability_status = CASE 
            WHEN availability_status = 'pending' AND v_availability_status = 'available' 
            THEN 'available'
            ELSE availability_status
          END,
          is_available = true,
          updated_at = now()
        WHERE id = v_existing_variant;
      ELSE
        -- Crear nueva variante
        INSERT INTO seller_catalog_variants (
          seller_catalog_id,
          variant_id,
          sku,
          stock,
          availability_status,
          is_available
        )
        VALUES (
          v_catalog_id,
          v_item.variant_id,
          v_item.sku,
          v_item.cantidad,
          v_availability_status,
          true
        );
      END IF;
      
      v_items_procesados := v_items_procesados + 1;
    END IF;
    
  END LOOP;
  
  -- Marcar el pedido como verificado/migrado
  UPDATE orders_b2b
  SET 
    payment_verified_by = COALESCE(p_admin_user_id, buyer_id), -- Si no hay admin, usar buyer_id
    payment_verified_at = now(),
    confirmed_at = COALESCE(confirmed_at, now()),
    internal_notes = COALESCE(internal_notes, '') || E'\n--- Migrado automáticamente al inventario B2C ---'
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pedido histórico migrado exitosamente',
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'items_procesados', v_items_procesados,
    'availability_status', v_availability_status,
    'store_id', v_store_id
  );
  
END;
$$ LANGUAGE plpgsql;

SELECT '✅ PASO 2: Función de migración creada' as resultado;

-- PASO 3: Migrar TODOS los pedidos históricos automáticamente
DO $$
DECLARE
  v_order RECORD;
  v_result JSONB;
  v_total_procesados INTEGER := 0;
  v_total_errores INTEGER := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando migración de pedidos históricos...';
  
  FOR v_order IN 
    SELECT DISTINCT o.id, o.order_number, o.status
    FROM orders_b2b o
    JOIN order_items_b2b oi ON oi.order_id = o.id
    WHERE o.status IN ('paid', 'completed', 'delivered')
      AND o.payment_verified_by IS NULL
      AND oi.variant_id IS NOT NULL
    ORDER BY o.created_at NULLS LAST
  LOOP
    
    -- Migrar el pedido
    SELECT migrar_pedido_historico(v_order.id) INTO v_result;
    
    IF (v_result->>'success')::boolean THEN
      v_total_procesados := v_total_procesados + 1;
      RAISE NOTICE '✅ Migrado: % (%) - % items', 
        v_order.order_number, 
        v_order.status,
        (v_result->>'items_procesados')::integer;
    ELSE
      v_total_errores := v_total_errores + 1;
      RAISE NOTICE '❌ Error: % - %', v_order.order_number, v_result->>'error';
    END IF;
    
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 MIGRACIÓN COMPLETADA:';
  RAISE NOTICE '   ✅ Pedidos procesados: %', v_total_procesados;
  RAISE NOTICE '   ❌ Errores: %', v_total_errores;
  
END $$;

SELECT '✅ PASO 3: Migración automática ejecutada' as resultado;

-- PASO 4: Verificación de la migración
SELECT 
  '📊 RESULTADO DE LA MIGRACIÓN' as info,
  o.status,
  COUNT(*) as total_pedidos,
  COUNT(CASE WHEN o.payment_verified_by IS NOT NULL THEN 1 END) as verificados,
  COUNT(CASE WHEN o.payment_verified_by IS NULL THEN 1 END) as pendientes
FROM orders_b2b o
WHERE o.status IN ('paid', 'completed', 'delivered')
GROUP BY o.status
ORDER BY o.status;

-- Ver inventario actualizado
SELECT 
  '📦 INVENTARIO B2C ACTUALIZADO' as info,
  sc.nombre as producto,
  COUNT(scv.id) as variantes,
  SUM(CASE WHEN scv.availability_status = 'available' THEN scv.stock ELSE 0 END) as stock_disponible,
  SUM(CASE WHEN scv.availability_status = 'pending' THEN scv.stock ELSE 0 END) as stock_pendiente,
  SUM(scv.stock) as stock_total
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
GROUP BY sc.id, sc.nombre
ORDER BY stock_total DESC;

-- Resumen por availability_status
SELECT 
  '📈 RESUMEN POR ESTADO' as info,
  scv.availability_status,
  COUNT(*) as total_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

SELECT '
✅✅✅ MIGRACIÓN DE PEDIDOS HISTÓRICOS COMPLETADA ✅✅✅

🎉 RESULTADOS:
- ✅ Pedidos históricos procesados y agregados al inventario B2C
- ✅ Campo payment_verified_by actualizado para rastreo
- ✅ Availability_status asignado según estado del pedido:
  * "paid" → "pending" (Disponible pronto)
  * "delivered" → "available" (En stock)

📋 PRÓXIMOS PASOS:
1. Verificar el inventario en v_seller_catalog_with_variants
2. Nuevos pedidos usarán el flujo con confirmación de admin
3. Pedidos históricos ya están disponibles para venta en B2C

' as resultado;
