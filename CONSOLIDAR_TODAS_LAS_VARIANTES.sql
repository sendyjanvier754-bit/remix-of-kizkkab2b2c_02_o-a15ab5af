-- =====================================================
-- CONSOLIDAR TODAS LAS VARIANTES (incluyendo pedidos 'placed')
-- =====================================================
-- Este script procesa TODOS los pedidos para consolidar
-- todas las variantes compradas en un solo producto
-- =====================================================

DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
  v_productos_creados INTEGER := 0;
  v_variantes_creadas INTEGER := 0;
  v_variantes_sumadas INTEGER := 0;
BEGIN
  
  RAISE NOTICE '🔄 Consolidando TODAS las variantes (incluyendo pedidos placed)...';
  
  -- Procesar TODOS los pedidos (incluyendo 'placed')
  FOR v_order IN 
    SELECT o.id, o.buyer_id, o.status, o.created_at
    FROM orders_b2b o
    WHERE o.status IN ('completed', 'delivered', 'paid', 'placed')
    ORDER BY o.created_at
  LOOP
    
    -- Obtener seller_store_id del comprador
    SELECT id INTO v_store_id
    FROM stores
    WHERE owner_user_id = v_order.buyer_id
    LIMIT 1;
    
    IF v_store_id IS NULL THEN
      RAISE NOTICE '⚠️ No se encontró store para buyer_id: %', v_order.buyer_id;
      CONTINUE;
    END IF;
    
    -- Procesar cada item del pedido
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
      WHERE oi.order_id = v_order.id
        AND oi.variant_id IS NOT NULL
    LOOP
      
      -- Buscar o crear registro principal del PRODUCTO (1 solo por producto)
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
        
        v_productos_creados := v_productos_creados + 1;
        RAISE NOTICE '  ✅ Producto creado: % (catalog_id: %)', v_item.nombre, v_catalog_id;
      END IF;
      
      -- Verificar si esta VARIANTE ya existe para este producto
      SELECT id INTO v_existing_variant
      FROM seller_catalog_variants
      WHERE seller_catalog_id = v_catalog_id
        AND variant_id = v_item.variant_id
      LIMIT 1;
      
      IF v_existing_variant IS NOT NULL THEN
        -- La variante existe → SUMAR stock
        UPDATE seller_catalog_variants
        SET 
          stock = stock + v_item.cantidad,
          is_available = true,
          updated_at = now()
        WHERE id = v_existing_variant;
        
        v_variantes_sumadas := v_variantes_sumadas + 1;
        RAISE NOTICE '  ➕ Stock sumado: % (+%)', v_item.sku, v_item.cantidad;
      ELSE
        -- Variante nueva → CREAR
        INSERT INTO seller_catalog_variants (
          seller_catalog_id,
          variant_id,
          sku,
          stock,
          is_available
        )
        VALUES (
          v_catalog_id,
          v_item.variant_id,
          v_item.sku,
          v_item.cantidad,
          true
        );
        
        v_variantes_creadas := v_variantes_creadas + 1;
        RAISE NOTICE '  ✅ Variante creada: % (stock: %)', v_item.sku, v_item.cantidad;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  RAISE NOTICE '📊 RESUMEN:';
  RAISE NOTICE '  - Productos creados: %', v_productos_creados;
  RAISE NOTICE '  - Variantes nuevas: %', v_variantes_creadas;
  RAISE NOTICE '  - Variantes con stock sumado: %', v_variantes_sumadas;
  RAISE NOTICE '✅ Consolidación completada';
  
END $$;

-- Verificación final
SELECT 
  '✅ RESULTADO FINAL' as info;

-- Productos totales
SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- Variantes totales
SELECT 
  '🎨 Variantes totales' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

-- Stock total
SELECT 
  '📦 Stock total' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- Vista detallada de productos con TODAS sus variantes
SELECT 
  '🔍 PRODUCTOS CON TODAS SUS VARIANTES' as info,
  sc.nombre as producto,
  s.name as tienda,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku ORDER BY scv.sku) as variantes_disponibles,
  array_agg(scv.stock ORDER BY scv.sku) as stock_por_variante
FROM seller_catalog sc
JOIN stores s ON s.id = sc.seller_store_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre, s.name
ORDER BY s.name, sc.nombre;

SELECT '✅✅✅ CONSOLIDACIÓN COMPLETA ✅✅✅' as resultado;
