-- =============================================================================
-- VERIFICACIÓN DE VISTA v_seller_inventory Y COLUMNAS seller_catalog
-- =============================================================================

-- 1. Verificar que las columnas se agregaron correctamente
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'seller_catalog'
  AND column_name IN ('precio_b2b_base', 'costo_logistica')
ORDER BY ordinal_position;

-- 2. Verificar datos en seller_catalog con desglose
SELECT 
  id,
  sku,
  nombre,
  precio_b2b_base,
  costo_logistica,
  precio_costo,
  (precio_b2b_base + costo_logistica) as suma_calculada,
  stock,
  is_active
FROM seller_catalog
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar que la vista v_seller_inventory existe y tiene datos
SELECT 
  id,
  sku,
  nombre,
  precio_b2b_base,
  costo_logistica,
  precio_costo,
  precio_venta,
  stock,
  ganancia_por_unidad,
  margen_porcentaje
FROM v_seller_inventory
ORDER BY created_at DESC
LIMIT 10;

-- 4. Comparar datos: seller_catalog vs v_seller_inventory
SELECT 
  'seller_catalog' as fuente,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN stock > 0 THEN 1 END) as con_stock,
  SUM(precio_b2b_base) as suma_precio_b2b,
  SUM(costo_logistica) as suma_logistica
FROM seller_catalog
UNION ALL
SELECT 
  'v_seller_inventory' as fuente,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN stock > 0 THEN 1 END) as con_stock,
  SUM(precio_b2b_base) as suma_precio_b2b,
  SUM(costo_logistica) as suma_logistica
FROM v_seller_inventory;

-- 5. Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_update_seller_inventory_from_b2b_order';
