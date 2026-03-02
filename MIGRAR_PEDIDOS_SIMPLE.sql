-- =====================================================
-- MIGRACIÓN SIMPLE DE PEDIDOS HISTÓRICOS
-- =====================================================
-- Versión simplificada que solo usa columnas básicas
-- =====================================================

-- PASO 1: Ver pedidos que necesitan migración
SELECT 
  '📋 PEDIDOS A MIGRAR' as info,
  o.id,
  o.order_number,
  o.status,
  o.buyer_id,
  o.total_amount,
  COUNT(oi.id) as total_items
FROM orders_b2b o
INNER JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.status IN ('paid', 'completed', 'delivered', 'placed')
  AND oi.variant_id IS NOT NULL
GROUP BY o.id, o.order_number, o.status, o.buyer_id, o.total_amount
ORDER BY o.created_at;

-- PASO 2: Migrar pedidos al inventario directamente
DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
  v_availability_status TEXT;
  v_total_pedidos INTEGER := 0;
  v_total_items INTEGER := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando migración...';
  
  -- Procesar cada pedido
  FOR v_order IN 
    SELECT DISTINCT o.id, o.order_number, o.status, o.buyer_id
    FROM orders_b2b o
    INNER JOIN order_items_b2b oi ON oi.order_id = o.id
    WHERE o.status IN ('paid', 'completed', 'delivered', 'placed')
      AND oi.variant_id IS NOT NULL
    ORDER BY o.created_at NULLS LAST
  LOOP
    
    -- Determinar availability_status según el estado
    IF v_order.status = 'paid' OR v_order.status = 'placed' THEN
      v_availability_status := 'pending';
    ELSE
      v_availability_status := 'available';
    END IF;
    
    -- Obtener seller_store_id del comprador
    SELECT id INTO v_store_id
    FROM stores
    WHERE owner_user_id = v_order.buyer_id
    LIMIT 1;
    
    -- Si el comprador no tiene tienda, saltar
    IF v_store_id IS NULL THEN
      RAISE NOTICE '⚠️  Pedido % - Comprador sin tienda', v_order.order_number;
      CONTINUE;
    END IF;
    
    -- Procesar items del pedido
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
      WHERE oi.order_id = v_order.id
        AND oi.variant_id IS NOT NULL
    LOOP
      
      -- Buscar o crear producto en seller_catalog
      SELECT id INTO v_catalog_id
      FROM seller_catalog
      WHERE seller_store_id = v_store_id
        AND source_product_id = v_item.product_id
      LIMIT 1;
      
      IF v_catalog_id IS NULL THEN
        INSERT INTO seller_catalog (
          seller_store_id, source_product_id, sku, nombre, descripcion, images, is_active
        ) VALUES (
          v_store_id, v_item.product_id, v_item.sku, v_item.nombre, v_item.descripcion, v_item.images, true
        ) RETURNING id INTO v_catalog_id;
      END IF;
      
      -- Buscar o crear variante
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
          seller_catalog_id, variant_id, sku, stock, availability_status, is_available
        ) VALUES (
          v_catalog_id, v_item.variant_id, v_item.sku, v_item.cantidad, v_availability_status, true
        );
      END IF;
      
      v_total_items := v_total_items + 1;
      
    END LOOP;
    
    v_total_pedidos := v_total_pedidos + 1;
    RAISE NOTICE '✅ Migrado: % (%)', v_order.order_number, v_order.status;
    
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 MIGRACIÓN COMPLETADA:';
  RAISE NOTICE '   Pedidos procesados: %', v_total_pedidos;
  RAISE NOTICE '   Items agregados: %', v_total_items;
  
END $$;

-- PASO 3: Verificar resultados
SELECT 
  '📦 INVENTARIO ACTUALIZADO' as info,
  sc.nombre as producto,
  COUNT(scv.id) as variantes,
  SUM(CASE WHEN scv.availability_status = 'available' THEN scv.stock ELSE 0 END) as stock_disponible,
  SUM(CASE WHEN scv.availability_status = 'pending' THEN scv.stock ELSE 0 END) as stock_pendiente,
  SUM(scv.stock) as stock_total
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
GROUP BY sc.id, sc.nombre
ORDER BY stock_total DESC;

-- Resumen por estado
SELECT 
  '📈 RESUMEN' as info,
  scv.availability_status,
  COUNT(*) as variantes,
  SUM(scv.stock) as stock
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

SELECT '✅✅✅ MIGRACIÓN COMPLETADA ✅✅✅' as resultado;
