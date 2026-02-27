-- =====================================================
-- MIGRACIÓN: Procesar Pedidos Históricos Pagados
-- =====================================================
-- Propósito: Agregar al inventario B2C todos los productos de pedidos
-- que YA ESTABAN pagados ANTES de implementar el trigger automático
-- =====================================================

-- PASO 1: Verificar cuántos pedidos pagados existen
SELECT 
  COUNT(*) as total_orders_paid,
  COUNT(DISTINCT seller_id) as unique_buyers
FROM orders_b2b
WHERE payment_status = 'paid';

-- PASO 2: Ver cuántos productos deberían agregarse
SELECT 
  o.id as order_id,
  o.seller_id,
  COUNT(oi.id) as items_count,
  SUM(oi.cantidad) as total_quantity
FROM orders_b2b o
JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.payment_status = 'paid'
GROUP BY o.id, o.seller_id
ORDER BY o.created_at DESC;

-- =====================================================
-- PASO 3: EJECUTAR MIGRACIÓN
-- =====================================================
-- Esta función procesa TODOS los pedidos históricos pagados

DO $$
DECLARE
  v_order RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_item RECORD;
  v_product_images JSONB;
  v_precio_b2b NUMERIC;
  v_costo_logistica NUMERIC;
  v_peso_total_kg NUMERIC;
  v_costo_logistica_total NUMERIC;
  v_costo_logistica_por_unidad NUMERIC;
  v_orders_processed INT := 0;
  v_items_added INT := 0;
  v_items_skipped INT := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando migración de pedidos históricos...';
  
  -- Iterar sobre todas las órdenes pagadas
  FOR v_order IN 
    SELECT id, seller_id, created_at
    FROM orders_b2b
    WHERE payment_status = 'paid'
    ORDER BY created_at ASC
  LOOP
    RAISE NOTICE '📦 Procesando orden: % (seller: %)', v_order.id, v_order.seller_id;
    
    -- Obtener la tienda del comprador
    SELECT id INTO v_store_id
    FROM stores
    WHERE owner_user_id = v_order.seller_id
    LIMIT 1;
    
    IF v_store_id IS NULL THEN
      RAISE WARNING '⚠️ No se encontró tienda para seller_id: % (orden: %)', v_order.seller_id, v_order.id;
      CONTINUE;
    END IF;
    
    -- CALCULAR LOGÍSTICA TOTAL DE LA ORDEN
    SELECT COALESCE(SUM(
      COALESCE(ld.weight_kg, 0) * oi.cantidad
    ), 0)
    INTO v_peso_total_kg
    FROM order_items_b2b oi
    LEFT JOIN v_logistics_data ld ON oi.product_id = ld.product_id
    WHERE oi.order_id = v_order.id;
    
    v_peso_total_kg := GREATEST(CEIL(v_peso_total_kg), 1);
    
    -- Calcular costo logística total
    SELECT 
      (v_peso_total_kg * st.tramo_a_cost_per_kg) +
      (v_peso_total_kg * 2.20462 * st.tramo_b_cost_per_lb) +
      COALESCE(sz.final_delivery_surcharge, 0)
    INTO v_costo_logistica_total
    FROM shipping_tiers st
    CROSS JOIN shipping_zones sz
    WHERE st.tier_type = 'STANDARD' 
      AND st.is_active = TRUE
      AND sz.zone_name = 'HAITI_CENTRO'
      AND sz.is_active = TRUE
    LIMIT 1;
    
    -- CRÍTICO: Asegurar que costo_logistica_total NUNCA sea NULL
    v_costo_logistica_total := COALESCE(v_costo_logistica_total, 0);
    
    -- Procesar cada item de la orden
    FOR v_item IN 
      SELECT 
        oi.product_id,
        oi.variant_id,
        oi.sku,
        oi.cantidad,
        oi.precio_unitario,
        p.nombre,
        p.descripcion_corta,
        p.imagen_principal,
        COALESCE(ld.weight_kg, 0) as weight_kg
      FROM order_items_b2b oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN v_logistics_data ld ON oi.product_id = ld.product_id
      WHERE oi.order_id = v_order.id
    LOOP
      -- Asegurar que precio_b2b nunca sea NULL
      v_precio_b2b := COALESCE(v_item.precio_unitario, 0);
      
      IF v_precio_b2b = 0 THEN
        RAISE WARNING '⚠️ Precio B2B es 0 para SKU: % en orden: %', v_item.sku, v_order.id;
        CONTINUE; -- Saltar items sin precio válido
      END IF;
      
      IF v_peso_total_kg > 0 THEN
        v_costo_logistica_por_unidad := (v_costo_logistica_total * v_item.weight_kg) / v_peso_total_kg;
      ELSE
        v_costo_logistica_por_unidad := 0;
      END IF;
      
      -- Asegurar que el costo logístico tampoco sea NULL
      v_costo_logistica_por_unidad := COALESCE(v_costo_logistica_por_unidad, 0);
      
      v_product_images := jsonb_build_array(v_item.imagen_principal);
      
      -- Verificar si ya existe (evitar duplicados)
      SELECT id INTO v_catalog_id
      FROM seller_catalog
      WHERE seller_store_id = v_store_id
        AND source_order_id = v_order.id
        AND source_product_id = v_item.product_id
        AND sku = v_item.sku;
      
      IF v_catalog_id IS NULL THEN
        -- Insertar nuevo producto
        INSERT INTO seller_catalog (
          seller_store_id,
          source_product_id,
          source_order_id,
          sku,
          nombre,
          descripcion,
          precio_venta,
          precio_costo,
          precio_b2b_base,
          costo_logistica,
          stock,
          images,
          is_active,
          metadata
        ) VALUES (
          v_store_id,
          v_item.product_id,
          v_order.id,
          v_item.sku,
          v_item.nombre,
          v_item.descripcion_corta,
          -- Asegurar que precio_venta NUNCA sea NULL
          GREATEST((v_precio_b2b + v_costo_logistica_por_unidad) * 2.5, v_precio_b2b),
          -- Asegurar que precio_costo NUNCA sea NULL
          v_precio_b2b + v_costo_logistica_por_unidad,
          v_precio_b2b,
          v_costo_logistica_por_unidad,
          v_item.cantidad,
          v_product_images,
          true,
          jsonb_build_object(
            'availability_status', 'disponible_pronto',
            'source_payment_status', 'paid',
            'added_on_payment', true,
            'migrated_from_historical', true,
            'migration_date', NOW()
          )
        );
        
        v_items_added := v_items_added + 1;
        RAISE NOTICE '  ✅ Agregado: % (SKU: %, Cantidad: %)', v_item.nombre, v_item.sku, v_item.cantidad;
      ELSE
        v_items_skipped := v_items_skipped + 1;
        RAISE NOTICE '  ⏭️ Ya existe: % (SKU: %)', v_item.nombre, v_item.sku;
      END IF;
    END LOOP;
    
    v_orders_processed := v_orders_processed + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Migración completada!';
  RAISE NOTICE '📊 Órdenes procesadas: %', v_orders_processed;
  RAISE NOTICE '📊 Productos agregados: %', v_items_added;
  RAISE NOTICE '📊 Productos omitidos (ya existían): %', v_items_skipped;
END $$;

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Ver productos agregados por la migración
SELECT 
  sc.id,
  sc.sku,
  sc.nombre,
  sc.stock,
  sc.precio_venta,
  sc.metadata->>'migrated_from_historical' as is_migrated,
  sc.metadata->>'migration_date' as migration_date,
  o.id as order_id,
  o.created_at as order_date
FROM seller_catalog sc
JOIN orders_b2b o ON sc.source_order_id = o.id
WHERE sc.metadata->>'migrated_from_historical' = 'true'
ORDER BY sc.created_at DESC
LIMIT 20;

-- Contar productos por tienda
SELECT 
  st.name as store_name,
  st.slug as store_slug,
  COUNT(sc.id) as productos_migrados,
  SUM(sc.stock) as stock_total
FROM seller_catalog sc
JOIN stores st ON sc.seller_store_id = st.id
WHERE sc.metadata->>'migrated_from_historical' = 'true'
GROUP BY st.id, st.name, st.slug
ORDER BY productos_migrados DESC;
