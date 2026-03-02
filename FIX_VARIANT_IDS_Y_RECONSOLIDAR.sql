-- =====================================================
-- FIX: Actualizar variant_ids y reconsolidar seller_catalog
-- =====================================================
-- Este script:
-- 1. Extrae atributos (color, size) del SKU en order_items_b2b
-- 2. Encuentra el variant_id correcto en product_variants
-- 3. Actualiza order_items_b2b.variant_id
-- 4. Limpia seller_catalog duplicados
-- 5. Re-ejecuta consolidación con variant_ids correctos
-- =====================================================

-- =============================================================================
-- PASO 1: Actualizar variant_ids en order_items_b2b desde SKU
-- =============================================================================

DO $$
DECLARE
  v_item RECORD;
  v_sku_parts TEXT[];
  v_color TEXT;
  v_size TEXT;
  v_variant_id UUID;
  v_updated_count INTEGER := 0;
BEGIN
  
  RAISE NOTICE '🔍 Buscando items sin variant_id...';
  
  -- Iterar sobre items que NO tienen variant_id
  FOR v_item IN 
    SELECT 
      oi.id as item_id,
      oi.product_id,
      oi.sku,
      oi.variant_id
    FROM order_items_b2b oi
    WHERE oi.variant_id IS NULL
      AND oi.sku IS NOT NULL
      AND oi.sku LIKE '%-%-%'  -- Formato: SKU-Color-Size
  LOOP
    
    -- Parsear SKU: "924221472274-Negro-3XL" → ["924221472274", "Negro", "3XL"]
    v_sku_parts := string_to_array(v_item.sku, '-');
    
    -- Extraer color y size
    IF array_length(v_sku_parts, 1) >= 3 THEN
      v_color := v_sku_parts[2];
      v_size := v_sku_parts[3];
      
      -- Buscar variant_id en product_variants
      SELECT pv.id INTO v_variant_id
      FROM product_variants pv
      WHERE pv.product_id = v_item.product_id
        AND pv.attribute_combination->>'color' = v_color
        AND (
          pv.attribute_combination->>'size' = v_size
          OR pv.attribute_combination->>'talla' = v_size
        )
      LIMIT 1;
      
      -- Si encontramos el variant, actualizar
      IF v_variant_id IS NOT NULL THEN
        UPDATE order_items_b2b
        SET 
          variant_id = v_variant_id,
          color = v_color,
          size = v_size,
          variant_attributes = jsonb_build_object('color', v_color, 'size', v_size)
        WHERE id = v_item.item_id;
        
        v_updated_count := v_updated_count + 1;
        
        RAISE NOTICE '✅ Item % → Variant % (%, %)', 
          v_item.sku, v_variant_id, v_color, v_size;
      ELSE
        RAISE NOTICE '⚠️ No se encontró variant para: % (%, %)', 
          v_item.sku, v_color, v_size;
      END IF;
    END IF;
    
  END LOOP;
  
  RAISE NOTICE '✅ Actualizados % items con variant_id', v_updated_count;
  
END $$;

SELECT '✅ PASO 1: variant_ids actualizados' as resultado;

-- =============================================================================
-- PASO 2: Limpiar seller_catalog y seller_catalog_variants
-- =============================================================================

-- Eliminar registros en seller_catalog_variants
DELETE FROM seller_catalog_variants;

-- Eliminar productos duplicados en seller_catalog (dejar solo 1 por producto)
WITH productos_duplicados AS (
  SELECT 
    seller_store_id,
    source_product_id,
    array_agg(id ORDER BY imported_at) as ids
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY seller_store_id, source_product_id
  HAVING COUNT(*) > 1
)
DELETE FROM seller_catalog
WHERE id IN (
  SELECT unnest(ids[2:]) FROM productos_duplicados
);

SELECT '✅ PASO 2: seller_catalog limpiado' as resultado;

-- =============================================================================
-- PASO 3: Re-ejecutar consolidación con variant_ids correctos
-- =============================================================================

DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
BEGIN
  
  RAISE NOTICE '🔄 Re-ejecutando consolidación con variant_ids actualizados...';
  
  -- Procesar pedidos completados/entregados
  FOR v_order IN 
    SELECT o.id, o.buyer_id, o.status, o.created_at
    FROM orders_b2b o
    WHERE o.status IN ('completed', 'delivered', 'paid')
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
        AND oi.variant_id IS NOT NULL  -- Solo procesar items con variant_id válido
    LOOP
      
      -- Buscar o crear registro principal del producto
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
        
        RAISE NOTICE '  ✅ Producto creado: % (catalog_id: %)', v_item.nombre, v_catalog_id;
      END IF;
      
      -- Verificar si esta variante ya existe
      SELECT id INTO v_existing_variant
      FROM seller_catalog_variants
      WHERE seller_catalog_id = v_catalog_id
        AND variant_id = v_item.variant_id
      LIMIT 1;
      
      IF v_existing_variant IS NOT NULL THEN
        -- Actualizar stock (SUMAR cantidades)
        UPDATE seller_catalog_variants
        SET 
          stock = stock + v_item.cantidad,
          is_available = true,
          updated_at = now()
        WHERE id = v_existing_variant;
        
        RAISE NOTICE '  ➕ Stock sumado: % (variant: %, +%)', 
          v_item.nombre, v_item.variant_id, v_item.cantidad;
      ELSE
        -- Crear nueva variante
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
        
        RAISE NOTICE '  ✅ Variante creada: % (variant: %, stock: %)', 
          v_item.nombre, v_item.variant_id, v_item.cantidad;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  RAISE NOTICE '✅ Consolidación completada';
  
END $$;

SELECT '✅ PASO 3: Consolidación completada' as resultado;

-- =============================================================================
-- PASO 4: Verificación final
-- =============================================================================

-- Contar productos consolidados
SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

-- Contar variantes creadas
SELECT 
  '🎨 Variantes en seller_catalog_variants' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

-- Stock total
SELECT 
  '📦 Stock total en variantes' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- Detalle de productos con variantes
SELECT 
  '🔍 PRODUCTOS CON VARIANTES' as info,
  sc.id as catalog_id,
  sc.nombre as producto,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku ORDER BY scv.sku) as skus_variantes,
  array_agg(scv.stock ORDER BY scv.sku) as stocks_variantes
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre
ORDER BY COUNT(scv.id) DESC;

SELECT '✅✅✅ MIGRACIÓN Y CONSOLIDACIÓN COMPLETADA ✅✅✅' as resultado;
