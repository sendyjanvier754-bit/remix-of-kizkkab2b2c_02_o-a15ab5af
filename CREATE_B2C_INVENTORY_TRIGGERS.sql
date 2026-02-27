-- =====================================================
-- TRIGGERS: Gestión Automática de Inventario B2C
-- =====================================================
-- Propósito:
-- 1. Cuando un pedido B2B se marca como PAGADO → agregar productos al inventario del buyer
-- 2. Cuando un pedido se cancela → eliminar productos del inventario del buyer
-- =====================================================

-- ============================================
-- TRIGGER 1: Agregar al inventario cuando se paga
-- ============================================

CREATE OR REPLACE FUNCTION add_to_buyer_inventory_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_store_id UUID;
  v_catalog_id UUID;
  v_item RECORD;
  v_product_images JSONB;
  v_precio_b2b NUMERIC;
  v_costo_logistica NUMERIC;
  v_peso_total_kg NUMERIC;
  v_costo_logistica_total NUMERIC;
  v_costo_logistica_por_unidad NUMERIC;
BEGIN
  -- Solo procesar cuando payment_status cambia a 'paid'
  IF NEW.payment_status != 'paid' OR OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Obtener la tienda del seller (quien compró en B2B)
  -- En orders_b2b, seller_id es el comprador mayorista
  SELECT id INTO v_store_id
  FROM stores
  WHERE owner_user_id = NEW.seller_id
  LIMIT 1;
  
  IF v_store_id IS NULL THEN
    RAISE WARNING 'No se encontró tienda para el seller_id: %', NEW.seller_id;
    RETURN NEW;
  END IF;
  
  -- CALCULAR LOGÍSTICA TOTAL DE LA ORDEN
  -- Sumar pesos de todos los items
  SELECT COALESCE(SUM(
    COALESCE(ld.weight_kg, 0) * oi.cantidad
  ), 0)
  INTO v_peso_total_kg
  FROM order_items_b2b oi
  LEFT JOIN v_logistics_data ld ON oi.product_id = ld.product_id
  WHERE oi.order_id = NEW.id;
  
  -- Aplicar CEIL al peso total
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
    WHERE oi.order_id = NEW.id
  LOOP
    -- Precio B2B es el precio_unitario de la orden
    v_precio_b2b := v_item.precio_unitario;
    
    -- Calcular costo de logística proporcional
    IF v_peso_total_kg > 0 THEN
      v_costo_logistica_por_unidad := (v_costo_logistica_total * v_item.weight_kg) / v_peso_total_kg;
    ELSE
      v_costo_logistica_por_unidad := 0;
    END IF;
    
    -- Preparar imágenes
    v_product_images := jsonb_build_array(v_item.imagen_principal);
    
    -- Verificar si ya existe esta entrada (mismo producto y orden)
    SELECT id INTO v_catalog_id
    FROM seller_catalog
    WHERE seller_store_id = v_store_id
      AND source_order_id = NEW.id
      AND source_product_id = v_item.product_id
      AND sku = v_item.sku;
    
    IF v_catalog_id IS NULL THEN
      -- Crear nueva entrada con metadata indicando "Disponible pronto"
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
        NEW.id,
        v_item.sku,
        v_item.nombre,
        v_item.descripcion_corta,
        (v_precio_b2b + v_costo_logistica_por_unidad) * 2.5,  -- Margen sugerido 150%
        v_precio_b2b + v_costo_logistica_por_unidad,
        v_precio_b2b,
        v_costo_logistica_por_unidad,
        v_item.cantidad,
        v_product_images,
        true,
        jsonb_build_object(
          'availability_status', 'disponible_pronto',
          'source_payment_status', 'paid',
          'added_on_payment', true
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_add_to_buyer_inventory_on_payment ON orders_b2b;

CREATE TRIGGER trg_add_to_buyer_inventory_on_payment
  AFTER UPDATE ON orders_b2b
  FOR EACH ROW
  WHEN (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
  EXECUTE FUNCTION add_to_buyer_inventory_on_payment();

COMMENT ON FUNCTION add_to_buyer_inventory_on_payment() IS 
  'Agrega productos al seller_catalog del buyer cuando payment_status = paid. Status: Disponible pronto';

-- ============================================
-- TRIGGER 2: Eliminar del inventario cuando se cancela
-- ============================================

CREATE OR REPLACE FUNCTION remove_from_buyer_inventory_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar cuando status cambia a 'cancelled'
  IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  
  -- Eliminar productos del seller_catalog que fueron agregados desde esta orden
  DELETE FROM seller_catalog
  WHERE source_order_id = NEW.id
    AND metadata->>'added_on_payment' = 'true';
  
  -- Log para debugging
  RAISE NOTICE 'Productos eliminados del inventario del buyer para orden: %', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_remove_from_buyer_inventory_on_cancel ON orders_b2b;

CREATE TRIGGER trg_remove_from_buyer_inventory_on_cancel
  AFTER UPDATE ON orders_b2b
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION remove_from_buyer_inventory_on_cancel();

COMMENT ON FUNCTION remove_from_buyer_inventory_on_cancel() IS 
  'Elimina productos del seller_catalog cuando una orden B2B se cancela';

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver triggers creados
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_add_to_buyer_inventory_on_payment',
  'trg_remove_from_buyer_inventory_on_cancel'
)
ORDER BY trigger_name;
