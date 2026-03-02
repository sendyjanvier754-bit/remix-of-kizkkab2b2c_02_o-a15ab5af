-- =====================================================
-- AGREGAR ESTADO "DISPONIBLE PRONTO" PARA PEDIDOS PAGADOS
-- =====================================================
-- Funcionalidad:
-- - Pedido 'paid': Producto aparece como "Disponible pronto"
-- - Pedido 'delivered'/'completed': Producto aparece como "Disponible ahora"
-- =====================================================

-- PASO 1: Agregar campo availability_status a seller_catalog_variants
ALTER TABLE seller_catalog_variants 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available'
CHECK (availability_status IN ('pending', 'available', 'out_of_stock'));

COMMENT ON COLUMN seller_catalog_variants.availability_status IS 
'pending = Pedido pagado pero no entregado (muestra "Disponible pronto")
available = Stock disponible para venta
out_of_stock = Sin stock';

SELECT '✅ PASO 1: Campo availability_status agregado' as resultado;

-- PASO 2: Actualizar trigger para manejar estados 'paid' y 'delivered'
CREATE OR REPLACE FUNCTION auto_add_to_seller_catalog_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
  v_availability_status TEXT;
BEGIN
  -- Solo ejecutar si el pedido cambia a paid, completed, o delivered
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
          END IF;
          
        END IF;
        
      END LOOP;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT '✅ PASO 2: Trigger actualizado con soporte "Disponible pronto"' as resultado;

-- PASO 3: Actualizar variantes existentes según el estado del pedido
UPDATE seller_catalog_variants scv
SET availability_status = CASE 
  WHEN EXISTS (
    SELECT 1 FROM order_items_b2b oi
    JOIN orders_b2b o ON o.id = oi.order_id
    WHERE oi.variant_id = scv.variant_id
      AND o.status IN ('completed', 'delivered')
  ) THEN 'available'
  WHEN EXISTS (
    SELECT 1 FROM order_items_b2b oi
    JOIN orders_b2b o ON o.id = oi.order_id
    WHERE oi.variant_id = scv.variant_id
      AND o.status = 'paid'
  ) THEN 'pending'
  ELSE 'available'
END;

SELECT '✅ PASO 3: Estados actualizados según pedidos' as resultado;

-- PASO 4: Actualizar vista v_seller_catalog_with_variants
-- Primero eliminar la vista existente
DROP VIEW IF EXISTS v_seller_catalog_with_variants;

-- Crear la nueva vista con campos de disponibilidad
CREATE VIEW v_seller_catalog_with_variants AS
SELECT 
  -- Datos del producto principal
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.nombre,
  sc.descripcion,
  sc.images,
  sc.is_active,
  sc.imported_at as catalog_created_at,
  
  -- Datos del producto maestro
  p.nombre as product_name,
  p.descripcion_corta as product_description,
  p.imagen_principal as product_image,
  p.galeria_imagenes as product_images,
  
  -- Agregados de variantes
  COUNT(scv.id) as total_variantes,
  SUM(CASE WHEN scv.availability_status = 'available' THEN scv.stock ELSE 0 END) as stock_available,
  SUM(CASE WHEN scv.availability_status = 'pending' THEN scv.stock ELSE 0 END) as stock_pending,
  SUM(scv.stock) as total_stock,
  json_agg(
    json_build_object(
      'variant_id', scv.id,
      'product_variant_id', scv.variant_id,
      'sku', scv.sku,
      'stock', scv.stock,
      'availability_status', scv.availability_status,
      'precio', COALESCE(scv.precio_override, pv.price),
      'is_available', scv.is_available,
      'attributes', pv.attribute_combination,
      'images', pv.images
    ) ORDER BY scv.created_at
  ) FILTER (WHERE scv.id IS NOT NULL) as variantes,
  
  -- Rango de precios
  MIN(COALESCE(scv.precio_override, pv.price)) as precio_min,
  MAX(COALESCE(scv.precio_override, pv.price)) as precio_max,
  
  -- Estado de disponibilidad
  BOOL_OR(scv.is_available AND scv.availability_status = 'available') as tiene_stock_disponible,
  BOOL_OR(scv.is_available AND scv.availability_status = 'pending') as tiene_stock_pendiente
  
FROM seller_catalog sc
LEFT JOIN products p ON p.id = sc.source_product_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
LEFT JOIN product_variants pv ON pv.id = scv.variant_id
WHERE sc.source_product_id IS NOT NULL
GROUP BY 
  sc.id, sc.seller_store_id, sc.source_product_id, sc.nombre, 
  sc.descripcion, sc.images, sc.is_active, sc.imported_at,
  p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes;

SELECT '✅ PASO 4: Vista actualizada con estados de disponibilidad' as resultado;

-- Verificación
SELECT 
  '📊 RESUMEN DE DISPONIBILIDAD' as info,
  scv.availability_status,
  COUNT(*) as total_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

SELECT '✅✅✅ FUNCIONALIDAD "DISPONIBLE PRONTO" IMPLEMENTADA ✅✅✅' as resultado;
