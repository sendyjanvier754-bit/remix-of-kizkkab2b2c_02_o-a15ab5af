-- =====================================================
-- RE-EJECUCIÓN: Vista v_seller_inventory con filtro de orden completada
-- =====================================================
-- Fecha: 2026-02-09
-- Propósito: Actualizar la vista para mostrar solo items de órdenes completadas/entregadas
-- 
-- INSTRUCCIONES:
-- 1. Copiar todo este script
-- 2. Ejecutar en Supabase SQL Editor
-- 3. Verificar que retorna "Success"
-- =====================================================

-- 1. DROP la vista existente
DROP VIEW IF EXISTS v_seller_inventory CASCADE;

-- 2. Recrear la vista con el filtro de orden
CREATE OR REPLACE VIEW v_seller_inventory AS
SELECT
  -- IDENTIFICADORES
  sc.id,
  sc.seller_store_id,
  sc.source_product_id,
  sc.source_order_id,
  sc.sku,
  
  -- INFORMACIÓN DEL PRODUCTO
  sc.nombre,
  sc.descripcion,
  sc.images,
  sc.is_active,
  sc.imported_at,
  sc.metadata,
  p.weight_kg,
  p.precio_sugerido_venta,
  
  -- COSTOS HISTÓRICOS (lo que realmente pagó el seller)
  sc.precio_b2b_base,      -- Precio B2B histórico
  sc.costo_logistica,       -- Costo logística histórico
  sc.precio_costo,          -- Total invertido (B2B + logística)
  
  -- PRECIO DE VENTA
  sc.precio_venta,
  
  -- STOCK
  sc.stock,
  
  -- TIMESTAMPS
  sc.created_at,
  sc.updated_at,
  
  -- DATOS DE LA ORDEN (para verificación)
  o.status as order_status,
  o.payment_status,
  o.confirmed_at,
  
  -- CÁLCULOS DE RENTABILIDAD
  (sc.precio_venta - sc.precio_costo) as ganancia_por_unidad,
  CASE 
    WHEN sc.precio_costo > 0 THEN
      ROUND((((sc.precio_venta - sc.precio_costo) / sc.precio_costo) * 100)::numeric, 1)
    ELSE 
      0
  END as margen_porcentaje

FROM seller_catalog sc

-- JOIN con productos para obtener peso y precio sugerido
LEFT JOIN products p ON sc.source_product_id = p.id

-- *** NUEVO: JOIN con órdenes para filtrar por estado ***
LEFT JOIN orders_b2b o ON sc.source_order_id = o.id

-- FILTROS
WHERE sc.stock > 0  -- Solo items con stock disponible
  AND (
    -- OPCIÓN 1: Items importados manualmente (sin orden asociada)
    sc.source_order_id IS NULL
    
    OR
    
    -- OPCIÓN 2: Items de órdenes B2B completadas o entregadas
    o.status IN ('completed', 'delivered')
  );

-- =====================================================
-- COMENTARIO: 
-- Esta vista ahora filtra correctamente para mostrar:
-- ✅ Items importados manualmente (source_order_id IS NULL)
-- ✅ Items de órdenes completadas (status = 'completed')
-- ✅ Items de órdenes entregadas (status = 'delivered')
-- ❌ NO muestra items de órdenes pendientes (status = 'pending')
-- ❌ NO muestra items de órdenes canceladas (status = 'cancelled')
-- =====================================================

-- 3. Verificar la vista
SELECT 
  'Vista creada exitosamente' as mensaje,
  COUNT(*) as items_en_inventario
FROM v_seller_inventory;

-- 4. Verificar estructura de órdenes
SELECT 
  status,
  COUNT(*) as cantidad_ordenes,
  SUM((
    SELECT COUNT(*) 
    FROM order_items_b2b oi 
    WHERE oi.order_id = o.id
  )) as total_items
FROM orders_b2b o
GROUP BY status
ORDER BY cantidad_ordenes DESC;

-- =====================================================
-- ESPERADO:
-- - Si hay 0 items en inventario: CORRECTO (no hay órdenes completadas aún)
-- - Si aparecen items: Verificar que order_status sea 'completed' o 'delivered'
-- =====================================================
