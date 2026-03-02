-- =====================================================
-- INSTALACIÓN COMPLETA: SISTEMA CON CONFIRMACIÓN DE ADMIN
-- =====================================================
-- Este script instala todo el sistema completo:
-- 1. Campo availability_status
-- 2. Trigger con confirmación de admin y cancelaciones
-- 3. Vista con stock disponible y pendiente
-- 4. Función para admins confirmen pagos
-- =====================================================

-- PASO 1: Agregar campo availability_status
ALTER TABLE seller_catalog_variants 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available'
CHECK (availability_status IN ('pending', 'available', 'out_of_stock'));

COMMENT ON COLUMN seller_catalog_variants.availability_status IS 
'pending = Pedido pagado pero no entregado (muestra "Disponible pronto")
available = Stock disponible para venta
out_of_stock = Sin stock';

SELECT '✅ PASO 1: Campo availability_status agregado' as resultado;

-- PASO 2: Actualizar trigger con confirmación de admin
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
  
  -- CASO 1: CANCELACIÓN - Restar del inventario
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    SELECT id INTO v_store_id FROM stores WHERE owner_user_id = NEW.buyer_id LIMIT 1;
    
    IF v_store_id IS NOT NULL THEN
      FOR v_item IN 
        SELECT oi.product_id, oi.variant_id, oi.cantidad, oi.sku
        FROM order_items_b2b oi
        WHERE oi.order_id = NEW.id AND oi.variant_id IS NOT NULL
      LOOP
        SELECT id INTO v_catalog_id FROM seller_catalog
        WHERE seller_store_id = v_store_id AND source_product_id = v_item.product_id LIMIT 1;
        
        IF v_catalog_id IS NOT NULL THEN
          SELECT id, stock INTO v_existing_variant, v_current_stock
          FROM seller_catalog_variants
          WHERE seller_catalog_id = v_catalog_id AND variant_id = v_item.variant_id LIMIT 1;
          
          IF v_existing_variant IS NOT NULL THEN
            v_current_stock := v_current_stock - v_item.cantidad;
            
            IF v_current_stock <= 0 THEN
              DELETE FROM seller_catalog_variants WHERE id = v_existing_variant;
              RAISE NOTICE '🗑️  Variante eliminada (stock=0)';
            ELSE
              UPDATE seller_catalog_variants
              SET stock = v_current_stock, updated_at = now()
              WHERE id = v_existing_variant;
              RAISE NOTICE '📉 Stock reducido: nuevo_stock=%', v_current_stock;
            END IF;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM seller_catalog_variants WHERE seller_catalog_id = v_catalog_id) THEN
            DELETE FROM seller_catalog WHERE id = v_catalog_id;
            RAISE NOTICE '🗑️  Producto eliminado (sin variantes)';
          END IF;
        END IF;
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;
  
  -- CASO 2: AGREGAR AL INVENTARIO (CON CONFIRMACIÓN DE ADMIN)
  IF NEW.status IN ('paid', 'completed', 'delivered') AND 
     NEW.payment_verified_by IS NOT NULL AND
     (OLD.status IS NULL OR 
      OLD.status NOT IN ('paid', 'completed', 'delivered') OR 
      OLD.payment_verified_by IS NULL) THEN
    
    IF NEW.status = 'paid' THEN
      v_availability_status := 'pending';
    ELSE
      v_availability_status := 'available';
    END IF;
    
    SELECT id INTO v_store_id FROM stores WHERE owner_user_id = NEW.buyer_id LIMIT 1;
    
    IF v_store_id IS NOT NULL THEN
      FOR v_item IN 
        SELECT 
          oi.product_id, oi.variant_id, oi.cantidad, oi.sku,
          p.nombre, p.descripcion_corta as descripcion,
          COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]) as images
        FROM order_items_b2b oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id AND oi.variant_id IS NOT NULL
      LOOP
        
        SELECT id INTO v_catalog_id FROM seller_catalog
        WHERE seller_store_id = v_store_id AND source_product_id = v_item.product_id LIMIT 1;
        
        IF v_catalog_id IS NULL THEN
          INSERT INTO seller_catalog (
            seller_store_id, source_product_id, sku, nombre, descripcion, images, is_active
          ) VALUES (
            v_store_id, v_item.product_id, v_item.sku, v_item.nombre, v_item.descripcion, v_item.images, true
          ) RETURNING id INTO v_catalog_id;
        END IF;
        
        IF v_item.variant_id IS NOT NULL THEN
          SELECT id INTO v_existing_variant FROM seller_catalog_variants
          WHERE seller_catalog_id = v_catalog_id AND variant_id = v_item.variant_id LIMIT 1;
          
          IF v_existing_variant IS NOT NULL THEN
            UPDATE seller_catalog_variants
            SET 
              stock = stock + v_item.cantidad,
              availability_status = CASE 
                WHEN availability_status = 'pending' AND v_availability_status = 'available' 
                THEN 'available' ELSE availability_status
              END,
              is_available = true,
              updated_at = now()
            WHERE id = v_existing_variant;
          ELSE
            INSERT INTO seller_catalog_variants (
              seller_catalog_id, variant_id, sku, stock, availability_status, is_available
            ) VALUES (
              v_catalog_id, v_item.variant_id, v_item.sku, v_item.cantidad, v_availability_status, true
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_add_to_seller_catalog_on_complete() IS 
  'Gestiona inventario del vendedor con confirmación de admin';

SELECT '✅ PASO 2: Trigger actualizado con confirmación de admin' as resultado;

-- PASO 3: Actualizar variantes existentes
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

SELECT '✅ PASO 3: Estados actualizados' as resultado;

-- PASO 4: Recrear vista con campos de disponibilidad
DROP VIEW IF EXISTS v_seller_catalog_with_variants;

CREATE VIEW v_seller_catalog_with_variants AS
SELECT 
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.nombre,
  sc.descripcion,
  sc.images,
  sc.is_active,
  sc.imported_at as catalog_created_at,
  p.nombre as product_name,
  p.descripcion_corta as product_description,
  p.imagen_principal as product_image,
  p.galeria_imagenes as product_images,
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
  MIN(COALESCE(scv.precio_override, pv.price)) as precio_min,
  MAX(COALESCE(scv.precio_override, pv.price)) as precio_max,
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

SELECT '✅ PASO 4: Vista actualizada' as resultado;

-- PASO 5: Crear función para que admins confirmen pagos
CREATE OR REPLACE FUNCTION admin_confirm_payment(
  p_order_id UUID,
  p_admin_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, order_number, status, payment_verified_by, buyer_id, total_amount
  INTO v_order FROM orders_b2b WHERE id = p_order_id;
  
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
  END IF;
  
  IF v_order.status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La orden no está en estado "paid"');
  END IF;
  
  IF v_order.payment_verified_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'El pago ya fue confirmado');
  END IF;
  
  UPDATE orders_b2b
  SET 
    payment_verified_by = p_admin_user_id,
    payment_verified_at = now(),
    confirmed_at = now(),
    internal_notes = CASE 
      WHEN internal_notes IS NULL THEN p_notes
      ELSE internal_notes || E'\n--- Pago confirmado ---\n' || COALESCE(p_notes, '')
    END
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pago confirmado. Los productos se agregarán al inventario B2C del comprador.',
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'confirmed_by', p_admin_user_id,
    'confirmed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION admin_confirm_payment IS 
  'Permite a un admin confirmar el pago de un pedido B2B';

SELECT '✅ PASO 5: Función de confirmación creada' as resultado;

-- Verificación Final
SELECT 
  '📊 RESUMEN FINAL' as info,
  scv.availability_status,
  COUNT(*) as total_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

SELECT '
✅✅✅ SISTEMA COMPLETO INSTALADO ✅✅✅

🔐 FLUJO DE CONFIRMACIÓN:
1️⃣  Usuario paga → status=''paid'' (NO aparece en inventario)
2️⃣  Admin confirma → admin_confirm_payment() → Aparece en inventario B2C
3️⃣  Pedido entregado → status=''delivered'' → Stock cambia a "Disponible"
4️⃣  Pedido cancelado → status=''cancelled'' → Stock se resta

💡 ADMIN PUEDE USAR:
SELECT admin_confirm_payment(
  p_order_id := ''uuid-del-pedido'',
  p_admin_user_id := auth.uid(),
  p_notes := ''Pago verificado''
);

📋 VER PEDIDOS PENDIENTES:
SELECT * FROM orders_b2b 
WHERE status = ''paid'' AND payment_verified_by IS NULL;
' as instrucciones;
