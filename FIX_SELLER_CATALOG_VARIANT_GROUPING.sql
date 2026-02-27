-- =====================================================
-- FIX: Agrupar Variantes en seller_catalog
-- =====================================================
-- PROBLEMA:
--   Cuando se compra un producto B2B con variantes, el trigger
--   crea UN registro separado en seller_catalog por cada variante.
--   Esto causa productos duplicados en B2C marketplace.
--
-- SOLUCIÓN:
--   1. Agregar variant_id a seller_catalog
--   2. Modificar trigger para verificar (source_product_id, variant_id)
--   3. Agrupar registros existentes con mismo source_product_id
-- =====================================================

-- =============================================================================
-- PASO 1: Agregar variant_id a seller_catalog
-- =============================================================================

ALTER TABLE seller_catalog 
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seller_catalog_variant_id 
  ON seller_catalog(variant_id) 
  WHERE variant_id IS NOT NULL;

-- Índice compuesto para búsquedas por producto + variante
CREATE INDEX IF NOT EXISTS idx_seller_catalog_product_variant 
  ON seller_catalog(source_product_id, variant_id, seller_store_id);

COMMENT ON COLUMN seller_catalog.variant_id IS 
  'ID de la variante específica (color, talla, etc.). NULL = producto sin variantes o variante base.';

-- =============================================================================
-- PASO 2: Migrar variant_id desde order_items_b2b
-- =============================================================================
-- Para registros existentes, intentar extraer variant_id desde order_items_b2b

UPDATE seller_catalog sc
SET variant_id = oi.variant_id
FROM order_items_b2b oi
WHERE sc.source_order_id = oi.order_id
  AND sc.source_product_id = oi.product_id
  AND sc.variant_id IS NULL
  AND oi.variant_id IS NOT NULL;

-- =============================================================================
-- PASO 3: Modificar el Trigger auto_add_to_seller_catalog_on_complete
-- =============================================================================

-- Primero, eliminar el trigger y función existentes
DROP TRIGGER IF EXISTS auto_add_to_seller_catalog_on_complete ON orders_b2b;
DROP FUNCTION IF EXISTS auto_add_to_seller_catalog_on_complete();

-- Crear la función mejorada con soporte para variantes
CREATE OR REPLACE FUNCTION auto_add_to_seller_catalog_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_buyer_id UUID;
  v_store_id UUID;
  v_item RECORD;
  v_catalog_id UUID;
  v_previous_stock INT;
  v_product_images JSONB;
BEGIN
  -- Solo procesar cuando el estado cambia a 'completed' o 'delivered'
  IF NEW.status IN ('completed', 'delivered') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
    
    v_buyer_id := NEW.buyer_id;
    
    -- Buscar o crear la tienda del comprador
    SELECT id INTO v_store_id
    FROM public.stores
    WHERE owner_user_id = v_buyer_id
    LIMIT 1;
    
    IF v_store_id IS NULL THEN
      -- Crear tienda placeholder para el comprador
      INSERT INTO public.stores (owner_user_id, name, slug, description)
      VALUES (
        v_buyer_id,
        'Mi Tienda',
        'tienda-' || REPLACE(v_buyer_id::TEXT, '-', ''),
        'Tienda creada automáticamente'
      )
      RETURNING id INTO v_store_id;
    END IF;
    
    -- Procesar cada item del pedido
    FOR v_item IN 
      SELECT oi.*, p.imagen_principal, p.galeria_imagenes, p.descripcion_corta
      FROM public.order_items_b2b oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      -- Preparar imágenes
      v_product_images := COALESCE(
        to_jsonb(ARRAY[v_item.imagen_principal] || COALESCE(v_item.galeria_imagenes, ARRAY[]::TEXT[])),
        '[]'::JSONB
      );
      
      -- ====================================================================
      -- BÚSQUEDA MEJORADA: Verificar por (source_product_id, variant_id)
      -- ====================================================================
      SELECT id, stock INTO v_catalog_id, v_previous_stock
      FROM public.seller_catalog
      WHERE seller_store_id = v_store_id 
        AND source_product_id = v_item.product_id
        AND (
          -- Ambos NULL: producto sin variantes
          (variant_id IS NULL AND v_item.variant_id IS NULL)
          OR 
          -- Misma variante
          (variant_id = v_item.variant_id)
        )
      LIMIT 1;
      
      IF v_catalog_id IS NOT NULL THEN
        -- ================================================================
        -- ACTUALIZAR STOCK EXISTENTE (mismo producto + misma variante)
        -- ================================================================
        UPDATE public.seller_catalog
        SET 
          stock = stock + v_item.cantidad,
          updated_at = now()
        WHERE id = v_catalog_id;
        
        -- Registrar movimiento
        INSERT INTO public.inventory_movements (
          seller_catalog_id,
          change_amount,
          previous_stock,
          new_stock,
          reason,
          reference_type,
          reference_id
        ) VALUES (
          v_catalog_id,
          v_item.cantidad,
          v_previous_stock,
          v_previous_stock + v_item.cantidad,
          'Importación por compra B2B',
          'b2b_order',
          NEW.id
        );
      ELSE
        -- ================================================================
        -- CREAR NUEVA ENTRADA (nuevo producto o nueva variante)
        -- ================================================================
        INSERT INTO public.seller_catalog (
          seller_store_id,
          source_product_id,
          variant_id,  -- ⭐ NUEVO: Agregar variant_id
          source_order_id,
          sku,
          nombre,
          descripcion,
          precio_venta,
          precio_costo,
          stock,
          images
        ) VALUES (
          v_store_id,
          v_item.product_id,
          v_item.variant_id,  -- ⭐ NUEVO: Incluir variant_id del item
          NEW.id,
          v_item.sku,
          v_item.nombre,
          v_item.descripcion_corta,
          v_item.precio_unitario * 1.3, -- Margen sugerido del 30%
          v_item.precio_unitario,
          v_item.cantidad,
          v_product_images
        )
        RETURNING id INTO v_catalog_id;
        
        -- Registrar movimiento inicial
        INSERT INTO public.inventory_movements (
          seller_catalog_id,
          change_amount,
          previous_stock,
          new_stock,
          reason,
          reference_type,
          reference_id
        ) VALUES (
          v_catalog_id,
          v_item.cantidad,
          0,
          v_item.cantidad,
          'Importación inicial por compra B2B',
          'b2b_order',
          NEW.id
        );
      END IF;
      
      -- Reducir stock del producto maestro
      UPDATE public.products
      SET stock_fisico = stock_fisico - v_item.cantidad
      WHERE id = v_item.product_id;
      
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER auto_add_to_seller_catalog_on_complete
  AFTER INSERT OR UPDATE ON orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_seller_catalog_on_complete();

-- =============================================================================
-- PASO 4: Limpiar duplicados existentes (OPCIONAL)
-- =============================================================================
-- Este paso agrupa registros existentes del mismo producto sin variant_id
-- PRECAUCIÓN: Solo ejecutar si quieres consolidar registros duplicados

/*
-- Identificar duplicados (mismo source_product_id, sin variant_id)
WITH duplicados AS (
  SELECT 
    source_product_id,
    seller_store_id,
    COUNT(*) as total,
    array_agg(id ORDER BY created_at) as ids,
    SUM(stock) as stock_total
  FROM seller_catalog
  WHERE variant_id IS NULL
    AND source_product_id IS NOT NULL
  GROUP BY source_product_id, seller_store_id
  HAVING COUNT(*) > 1
)
SELECT 
  '⚠️ DUPLICADOS ENCONTRADOS' as alerta,
  source_product_id,
  total as "Registros duplicados",
  stock_total as "Stock total"
FROM duplicados
ORDER BY total DESC;

-- Para consolidar duplicados (DESCOMENTA Y EJECUTA CON PRECAUCIÓN):
-- UPDATE seller_catalog sc
-- SET stock = (
--   SELECT SUM(stock) 
--   FROM seller_catalog 
--   WHERE source_product_id = sc.source_product_id 
--     AND seller_store_id = sc.seller_store_id
--     AND variant_id IS NULL
-- )
-- WHERE id IN (
--   SELECT (array_agg(id ORDER BY created_at))[1]
--   FROM seller_catalog
--   WHERE variant_id IS NULL
--     AND source_product_id IS NOT NULL
--   GROUP BY source_product_id, seller_store_id
--   HAVING COUNT(*) > 1
-- );

-- DELETE FROM seller_catalog
-- WHERE id IN (
--   SELECT unnest((array_agg(id ORDER BY created_at))[2:])
--   FROM seller_catalog
--   WHERE variant_id IS NULL
--     AND source_product_id IS NOT NULL
--   GROUP BY source_product_id, seller_store_id
--   HAVING COUNT(*) > 1
-- );
*/

-- =============================================================================
-- PASO 5: Verificaciones
-- =============================================================================

-- Ver estructura actualizada
SELECT 
  '✅ ESTRUCTURA seller_catalog' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seller_catalog'
  AND column_name IN ('id', 'source_product_id', 'variant_id', 'sku', 'stock')
ORDER BY ordinal_position;

-- Ver índices creados
SELECT 
  '📇 ÍNDICES seller_catalog' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'seller_catalog'
  AND indexname LIKE '%variant%'
ORDER BY indexname;

-- Ver función del trigger
SELECT 
  '⚙️ TRIGGER FUNCTION' as info,
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%variant_id%' THEN '✅ Incluye variant_id'
    ELSE '❌ NO incluye variant_id'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'auto_add_to_seller_catalog_on_complete';

-- Muestra de datos (primeros 5 registros con variant info)
SELECT 
  '📊 MUESTRA DE DATOS' as info,
  sc.id,
  sc.sku,
  sc.nombre,
  sc.source_product_id,
  sc.variant_id,
  CASE 
    WHEN sc.variant_id IS NOT NULL THEN '✅ Con variante'
    ELSE 'Sin variante'
  END as tiene_variante,
  sc.stock
FROM seller_catalog sc
ORDER BY sc.created_at DESC
LIMIT 5;

-- =============================================================================
-- RESULTADO ESPERADO:
-- =============================================================================
-- ✅ seller_catalog tiene columna variant_id
-- ✅ Trigger verifica (source_product_id, variant_id) antes de crear
-- ✅ Productos con variantes se agrupan correctamente
-- ✅ En B2C marketplace se muestra 1 producto con múltiples variantes
-- =====================================================
