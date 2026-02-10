-- =============================================================================
-- ADD COST BREAKDOWN TO SELLER_CATALOG
-- Fecha: 2026-02-09
-- Propósito: Agregar desglose de costos (precio B2B + logística) al inventario
-- =============================================================================

-- 1. AGREGAR COLUMNAS A SELLER_CATALOG
-- =============================================================================

ALTER TABLE seller_catalog 
  ADD COLUMN IF NOT EXISTS precio_b2b_base NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_logistica NUMERIC DEFAULT 0;

COMMENT ON COLUMN seller_catalog.precio_b2b_base IS 
  'Precio B2B base del producto (sin logística) al momento de la compra';
  
COMMENT ON COLUMN seller_catalog.costo_logistica IS 
  'Costo de logística pagado por unidad en la orden B2B original';

-- 2. MIGRAR DATOS EXISTENTES (Estimación retroactiva)
-- =============================================================================
-- Para registros existentes, intentamos calcular el desglose usando v_business_panel_data actual
-- NOTA: Esto es una aproximación, los valores reales pueden haber cambiado

UPDATE seller_catalog sc
SET 
  precio_b2b_base = COALESCE(
    (SELECT bp.cost_per_unit 
     FROM v_business_panel_data bp 
     WHERE bp.product_id = sc.source_product_id 
     AND bp.variant_id IS NULL 
     LIMIT 1),
    sc.precio_costo * 0.7  -- Fallback: asume ~30% es logística
  ),
  costo_logistica = COALESCE(
    (SELECT bp.shipping_cost_per_unit 
     FROM v_business_panel_data bp 
     WHERE bp.product_id = sc.source_product_id 
     AND bp.variant_id IS NULL 
     LIMIT 1),
    sc.precio_costo * 0.3  -- Fallback: asume ~30% es logística
  )
WHERE precio_b2b_base IS NULL OR precio_b2b_base = 0;

-- 3. CREAR VISTA UNIFICADA PARA INVENTARIO SELLER
-- =============================================================================

CREATE OR REPLACE VIEW v_seller_inventory AS
SELECT
  sc.id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.source_order_id,
  sc.sku,
  sc.nombre,
  sc.descripcion,
  
  -- COSTOS (históricos del pedido)
  sc.precio_b2b_base,
  sc.costo_logistica,
  sc.precio_costo,  -- Total = precio_b2b_base + costo_logistica
  
  -- VENTA
  sc.precio_venta,
  
  -- STOCK
  sc.stock,
  
  -- IMÁGENES (desde seller_catalog o product original)
  CASE
    WHEN sc.images IS NOT NULL AND jsonb_array_length(sc.images) > 0 
    THEN sc.images
    ELSE COALESCE(
      jsonb_build_array(p.imagen_principal),
      '[]'::jsonb
    )
  END as images,
  
  -- METADATA
  sc.metadata,
  sc.is_active,
  sc.imported_at,
  sc.created_at,
  sc.updated_at,
  
  -- DATOS DEL PRODUCTO ORIGINAL (para referencia)
  p.weight_kg,
  p.imagen_principal,
  p.precio_sugerido_venta,
  
  -- DATOS DE LA ORDEN (para verificación)
  o.status as order_status,
  o.payment_status,
  o.confirmed_at,
  
  -- CÁLCULOS
  (sc.precio_venta - sc.precio_costo) as ganancia_por_unidad,
  CASE 
    WHEN sc.precio_costo > 0 
    THEN ROUND((((sc.precio_venta - sc.precio_costo) / sc.precio_costo) * 100)::numeric, 1)
    ELSE 0
  END as margen_porcentaje

FROM seller_catalog sc
LEFT JOIN products p ON sc.source_product_id = p.id
LEFT JOIN orders_b2b o ON sc.source_order_id = o.id
WHERE sc.stock > 0  -- Solo productos con stock disponible
  AND (
    sc.source_order_id IS NULL  -- Items importados manualmente
    OR o.status IN ('completed', 'delivered')  -- O de órdenes completadas
  );

COMMENT ON VIEW v_seller_inventory IS 
  'Vista de inventario del seller con desglose de costos históricos. Solo muestra productos con stock > 0 de órdenes completadas o importados manualmente.';

-- 4. ACTUALIZAR FUNCIÓN DE CREACIÓN DE INVENTARIO
-- =============================================================================
-- Esta función se dispara cuando una orden B2B se completa

CREATE OR REPLACE FUNCTION update_seller_inventory_from_b2b_order()
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
  -- Solo procesar cuando el estado cambia a 'completed' o 'delivered'
  IF NEW.status NOT IN ('completed', 'delivered') OR OLD.status IN ('completed', 'delivered') THEN
    RETURN NEW;
  END IF;
  
  -- Obtener la tienda del seller
  SELECT id INTO v_store_id
  FROM stores
  WHERE owner_user_id = NEW.seller_user_id
  LIMIT 1;
  
  IF v_store_id IS NULL THEN
    RAISE WARNING 'No se encontró tienda para el seller_user_id: %', NEW.seller_user_id;
    RETURN NEW;
  END IF;
  
  -- CALCULAR LOGÍSTICA TOTAL DE LA ORDEN (con redondeo correcto)
  -- Sumar pesos de todos los items
  SELECT COALESCE(SUM(
    COALESCE(ld.weight_kg, 0) * oi.cantidad
  ), 0)
  INTO v_peso_total_kg
  FROM order_items_b2b oi
  LEFT JOIN v_logistics_data ld ON oi.product_id = ld.product_id
  WHERE oi.order_id = NEW.id;
  
  -- Aplicar CEIL al peso total (no por item)
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
      oi.precio_unitario,  -- Este es el precio B2B que pagó
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
    
    -- Calcular costo de logística proporcional al peso del item
    IF v_peso_total_kg > 0 THEN
      v_costo_logistica_por_unidad := (v_costo_logistica_total * v_item.weight_kg) / v_peso_total_kg;
    ELSE
      v_costo_logistica_por_unidad := 0;
    END IF;
    
    -- Preparar imágenes
    v_product_images := jsonb_build_array(v_item.imagen_principal);
    
    -- Verificar si ya existe en el catálogo
    SELECT id INTO v_catalog_id
    FROM seller_catalog
    WHERE seller_store_id = v_store_id
      AND source_product_id = v_item.product_id
      AND (
        (v_item.variant_id IS NULL AND sku = v_item.sku) OR
        (v_item.variant_id IS NOT NULL AND sku = v_item.sku)
      );
    
    IF v_catalog_id IS NOT NULL THEN
      -- Actualizar stock existente
      UPDATE seller_catalog
      SET 
        stock = stock + v_item.cantidad,
        updated_at = NOW()
      WHERE id = v_catalog_id;
    ELSE
      -- Crear nueva entrada con desglose de costos
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
        images
      ) VALUES (
        v_store_id,
        v_item.product_id,
        NEW.id,
        v_item.sku,
        v_item.nombre,
        v_item.descripcion_corta,
        (v_precio_b2b + v_costo_logistica_por_unidad) * 2.5,  -- Margen sugerido 150%
        v_precio_b2b + v_costo_logistica_por_unidad,  -- Costo total
        v_precio_b2b,  -- Precio B2B base
        v_costo_logistica_por_unidad,  -- Costo logística
        v_item.cantidad,
        v_product_images
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger
DROP TRIGGER IF EXISTS trg_update_seller_inventory_from_b2b_order ON orders_b2b;

CREATE TRIGGER trg_update_seller_inventory_from_b2b_order
  AFTER UPDATE ON orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_inventory_from_b2b_order();

COMMENT ON FUNCTION update_seller_inventory_from_b2b_order() IS 
  'Actualiza seller_catalog cuando una orden B2B se completa. Calcula logística con redondeo total de peso (CEIL aplicado al peso sumado)';

-- 5. VERIFICACIÓN
-- =============================================================================

-- Query para verificar la migración
-- SELECT 
--   id,
--   sku,
--   nombre,
--   precio_b2b_base,
--   costo_logistica,
--   precio_costo,
--   stock
-- FROM seller_catalog
-- LIMIT 10;

-- Query para verificar la vista
-- SELECT * FROM v_seller_inventory LIMIT 5;
