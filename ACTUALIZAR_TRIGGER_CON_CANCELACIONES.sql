-- =====================================================
-- ACTUALIZAR TRIGGER PARA MANEJAR CANCELACIONES
-- =====================================================
-- Funcionalidad:
-- - Pedido 'paid': Agrega stock con status 'pending'
-- - Pedido 'delivered': Agrega/actualiza stock con status 'available'
-- - Pedido 'cancelled': RESTA stock del inventario
-- =====================================================

CREATE OR REPLACE FUNCTION auto_add_to_seller_catalog_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
  v_availability_status TEXT;
  v_current_stock INTEGER;
BEGIN
  
  -- ========================================
  -- CASO 1: CANCELACIÓN - Restar del inventario
  -- ========================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Obtener seller_store_id del comprador
    SELECT id INTO v_store_id
    FROM stores
    WHERE owner_user_id = NEW.buyer_id
    LIMIT 1;
    
    IF v_store_id IS NOT NULL THEN
      
      -- Iterar sobre cada item del pedido cancelado
      FOR v_item IN 
        SELECT 
          oi.product_id,
          oi.variant_id,
          oi.cantidad,
          oi.sku
        FROM order_items_b2b oi
        WHERE oi.order_id = NEW.id
          AND oi.variant_id IS NOT NULL
      LOOP
        
        -- Buscar el producto en seller_catalog
        SELECT id INTO v_catalog_id
        FROM seller_catalog
        WHERE seller_store_id = v_store_id
          AND source_product_id = v_item.product_id
        LIMIT 1;
        
        -- Si existe el producto, procesar la variante
        IF v_catalog_id IS NOT NULL THEN
          
          -- Buscar la variante
          SELECT id, stock INTO v_existing_variant, v_current_stock
          FROM seller_catalog_variants
          WHERE seller_catalog_id = v_catalog_id
            AND variant_id = v_item.variant_id
          LIMIT 1;
          
          IF v_existing_variant IS NOT NULL THEN
            
            -- Calcular nuevo stock
            v_current_stock := v_current_stock - v_item.cantidad;
            
            IF v_current_stock <= 0 THEN
              -- Si stock llega a 0 o menos, eliminar la variante
              DELETE FROM seller_catalog_variants
              WHERE id = v_existing_variant;
              
              RAISE NOTICE '🗑️  Variante eliminada (stock=0): product_id=%, variant_id=%', 
                v_item.product_id, v_item.variant_id;
            ELSE
              -- Si aún hay stock, actualizar cantidad
              UPDATE seller_catalog_variants
              SET 
                stock = v_current_stock,
                availability_status = CASE 
                  WHEN v_current_stock > 0 THEN availability_status
                  ELSE 'out_of_stock'
                END,
                updated_at = now()
              WHERE id = v_existing_variant;
              
              RAISE NOTICE '📉 Stock reducido: product_id=%, variant_id=%, nuevo_stock=%', 
                v_item.product_id, v_item.variant_id, v_current_stock;
            END IF;
            
          END IF;
          
          -- Verificar si el producto principal ya no tiene variantes
          IF NOT EXISTS (
            SELECT 1 FROM seller_catalog_variants 
            WHERE seller_catalog_id = v_catalog_id
          ) THEN
            -- Si no quedan variantes, eliminar el producto principal
            DELETE FROM seller_catalog
            WHERE id = v_catalog_id;
            
            RAISE NOTICE '🗑️  Producto principal eliminado (sin variantes): catalog_id=%', v_catalog_id;
          END IF;
          
        END IF;
        
      END LOOP;
      
    END IF;
    
    RETURN NEW;
  END IF;
  
  
  -- ========================================
  -- CASO 2: AGREGAR/ACTUALIZAR INVENTARIO
  -- ========================================
  IF NEW.status IN ('paid', 'completed', 'delivered') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('paid', 'completed', 'delivered')) THEN
    
    -- Determinar el estado de disponibilidad según el status del pedido
    IF NEW.status = 'paid' THEN
      v_availability_status := 'pending'; -- Muestra "Disponible pronto"
    ELSE
      v_availability_status := 'available'; -- Muestra "Disponible ahora"
    END IF;
    
    -- Obtener seller_store_id del comprador
    SELECT id INTO v_store_id
    FROM stores
    WHERE owner_user_id = NEW.buyer_id
    LIMIT 1;
    
    -- Si el comprador tiene seller_store, agregar productos a su catálogo
    IF v_store_id IS NOT NULL THEN
      
      -- Iterar sobre cada item del pedido
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
        WHERE oi.order_id = NEW.id
          AND oi.variant_id IS NOT NULL
      LOOP
        
        -- Buscar o crear registro principal del producto en seller_catalog
        SELECT id INTO v_catalog_id
        FROM seller_catalog
        WHERE seller_store_id = v_store_id
          AND source_product_id = v_item.product_id
        LIMIT 1;
        
        -- Si no existe el producto, crearlo
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
          
          RAISE NOTICE '✅ Producto creado: catalog_id=%, product_id=%', v_catalog_id, v_item.product_id;
        END IF;
        
        -- Ahora manejar la variante
        IF v_item.variant_id IS NOT NULL THEN
          
          -- Verificar si esta variante ya existe para este catálogo
          SELECT id INTO v_existing_variant
          FROM seller_catalog_variants
          WHERE seller_catalog_id = v_catalog_id
            AND variant_id = v_item.variant_id
          LIMIT 1;
          
          IF v_existing_variant IS NOT NULL THEN
            -- Actualizar variante existente:
            -- Si la variante está 'pending' y ahora llega 'available', actualizar
            -- Si ya está 'available', solo sumar stock
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
            
            RAISE NOTICE '📈 Stock agregado: variant_id=%, cantidad=%', v_item.variant_id, v_item.cantidad;
          ELSE
            -- Crear nueva variante con el estado correspondiente
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
            
            RAISE NOTICE '✨ Nueva variante creada: variant_id=%, stock=%', v_item.variant_id, v_item.cantidad;
          END IF;
          
        END IF;
        
      END LOOP;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_add_to_seller_catalog_on_complete() IS 
  'Trigger que gestiona el inventario del vendedor:
  - paid/completed/delivered: Agrega productos al inventario
  - cancelled: Resta productos del inventario';

SELECT '✅ Trigger actualizado con soporte para cancelaciones' as resultado;

-- Verificación de la función
SELECT 
  '📋 TRIGGER CONFIGURADO' as info,
  p.proname as nombre_funcion,
  pg_get_functiondef(p.oid) as definicion_completa
FROM pg_proc p
WHERE p.proname = 'auto_add_to_seller_catalog_on_complete';

SELECT '✅✅✅ CANCELACIONES IMPLEMENTADAS ✅✅✅' as resultado;
SELECT '⚠️  Ahora cuando un pedido se cancela, el stock se restará automáticamente' as nota;
