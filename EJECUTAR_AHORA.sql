-- =====================================================
-- SQL A EJECUTAR EN SUPABASE
-- =====================================================
-- Copiar y pegar todo este bloque en Supabase SQL Editor
-- =====================================================

DROP VIEW IF EXISTS v_seller_inventory CASCADE;

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
  
  -- CÁLCULOS DE RENTABILIDAD
  (sc.precio_venta - sc.precio_costo) as ganancia_por_unidad,
  CASE 
    WHEN sc.precio_costo > 0 THEN
      ROUND((((sc.precio_venta - sc.precio_costo) / sc.precio_costo) * 100)::numeric, 1)
    ELSE 
      0
  END as margen_porcentaje

FROM seller_catalog sc
LEFT JOIN products p ON sc.source_product_id = p.id
LEFT JOIN orders_b2b o ON sc.source_order_id = o.id

WHERE sc.stock > 0
  AND (
    sc.source_order_id IS NULL
    OR o.status IN ('completed', 'delivered')
  );

-- Verificar
SELECT 'Vista creada exitosamente' as mensaje, COUNT(*) as items_en_inventario FROM v_seller_inventory;
