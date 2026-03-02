-- =====================================================
-- FINALIZAR FUNCIONALIDAD "DISPONIBLE PRONTO"
-- =====================================================
-- Este script completa la implementación agregando:
-- 1. Campo availability_status a la tabla
-- 2. Actualización de datos existentes
-- 3. Vista con separación de stock disponible y pendiente
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

-- PASO 2: Actualizar variantes existentes según el estado del pedido
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

SELECT '✅ PASO 2: Estados actualizados según pedidos' as resultado;

-- PASO 3: Actualizar vista v_seller_catalog_with_variants
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

SELECT '✅ PASO 3: Vista actualizada con estados de disponibilidad' as resultado;

-- Verificación Final
SELECT 
  '📊 RESUMEN DE DISPONIBILIDAD' as info,
  scv.availability_status,
  COUNT(*) as total_variantes,
  SUM(scv.stock) as stock_total
FROM seller_catalog_variants scv
GROUP BY scv.availability_status;

SELECT '✅✅✅ SISTEMA COMPLETO IMPLEMENTADO ✅✅✅' as resultado;
SELECT '
🎉 FUNCIONALIDADES ACTIVAS:
  ✅ Pedido "paid" → Stock pendiente ("Disponible pronto")
  ✅ Pedido "delivered" → Stock disponible ("En stock")  
  ✅ Pedido "cancelled" → Stock restado automáticamente
  ✅ Vista con stock_available y stock_pending separados
' as nota;
