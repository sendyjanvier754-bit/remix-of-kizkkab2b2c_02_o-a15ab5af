-- =====================================================
-- REFACTOR: SELLER CATALOG - ESTILO AMAZON/ALIBABA
-- =====================================================
-- Arquitectura:
-- - seller_catalog: 1 registro por PRODUCTO (sin variantes)
-- - seller_catalog_variants: N registros (1 por cada variante comprada)
-- - Stock separado por variante (como Amazon)
-- =====================================================

-- =============================================================================
-- PASO 1: Crear tabla seller_catalog_variants  
-- =============================================================================

CREATE TABLE IF NOT EXISTS seller_catalog_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con seller_catalog (el producto)
  seller_catalog_id UUID NOT NULL REFERENCES seller_catalog(id) ON DELETE CASCADE,
  
  -- Relación con product_variants (variante específica)
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  
  -- SKU de esta variante
  sku TEXT NOT NULL,
  
  -- Stock individual de esta variante
  stock INTEGER NOT NULL DEFAULT 0,
  
  -- Precio personalizado (opcional, hereda del product_variant si NULL)
  precio_override DECIMAL(10,2),
  
  -- Disponibilidad
  is_available BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: Un vendedor no puede tener la misma variante duplicada
  CONSTRAINT seller_catalog_variants_unique_variant 
    UNIQUE (seller_catalog_id, variant_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_seller_catalog_variants_catalog 
  ON seller_catalog_variants(seller_catalog_id);

CREATE INDEX IF NOT EXISTS idx_seller_catalog_variants_variant 
  ON seller_catalog_variants(variant_id);

CREATE INDEX IF NOT EXISTS idx_seller_catalog_variants_sku 
  ON seller_catalog_variants(sku);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_seller_catalog_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seller_catalog_variants_updated_at
  BEFORE UPDATE ON seller_catalog_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_catalog_variants_updated_at();

SELECT '✅ PASO 1: Tabla seller_catalog_variants creada' as resultado;

-- =============================================================================
-- PASO 2: Migrar datos existentes a nueva estructura
-- =============================================================================

-- 2A: Identificar productos que deben consolidarse
-- Primero vemos qué vamos a consolidar

WITH productos_a_consolidar AS (
  SELECT 
    seller_store_id,
    source_product_id,
    COUNT(*) as total_registros,
    array_agg(id ORDER BY created_at) as ids,
    array_agg(variant_id ORDER BY created_at) as variant_ids,
    array_agg(sku ORDER BY created_at) as skus,
    array_agg(stock ORDER BY created_at) as stocks
  FROM seller_catalog
  WHERE source_product_id IS NOT NULL
  GROUP BY seller_store_id, source_product_id
)
SELECT 
  '📋 PRODUCTOS A CONSOLIDAR' as info,
  pac.seller_store_id,
  pac.source_product_id,
  pac.total_registros as registros_actuales,
  pac.skus as skus_variantes,
  pac.stocks as stocks_variantes,
  p.nombre as producto_nombre
FROM productos_a_consolidar pac
LEFT JOIN products p ON p.id = pac.source_product_id
ORDER BY pac.total_registros DESC;

-- 2B: Consolidación y migración
-- Para cada grupo de registros con mismo (seller_store_id, source_product_id):
-- - Mantener 1 registro en seller_catalog (el más antiguo)
-- - Crear registros en seller_catalog_variants para cada variante
-- - Eliminar registros duplicados

DO $$
DECLARE
  v_grupo RECORD;
  v_catalog_id UUID;
  v_variant_record RECORD;
  v_total_consolidados INTEGER := 0;
  v_total_variantes_creadas INTEGER := 0;
BEGIN
  
  -- Iterar sobre cada grupo de productos
  FOR v_grupo IN 
    SELECT 
      seller_store_id,
      source_product_id,
      array_agg(id ORDER BY created_at) as ids,
      array_agg(variant_id ORDER BY created_at) as variant_ids,
      array_agg(sku ORDER BY created_at) as skus,
      array_agg(stock ORDER BY created_at) as stocks
    FROM seller_catalog
    WHERE source_product_id IS NOT NULL
    GROUP BY seller_store_id, source_product_id
  LOOP
    
    -- El primer ID es el que mantenemos como registro principal
    v_catalog_id := v_grupo.ids[1];
    
    -- Para cada variante en este grupo
    FOR i IN 1..array_length(v_grupo.ids, 1) LOOP
      
      -- Si tiene variant_id válido, crear registro en seller_catalog_variants
      IF v_grupo.variant_ids[i] IS NOT NULL THEN
        
        INSERT INTO seller_catalog_variants (
          seller_catalog_id,
          variant_id,
          sku,
          stock,
          is_available,
          created_at
        )
        VALUES (
          v_catalog_id,
          v_grupo.variant_ids[i],
          v_grupo.skus[i],
          COALESCE(v_grupo.stocks[i], 0),
          true,
          now()
        )
        ON CONFLICT (seller_catalog_id, variant_id) 
        DO UPDATE SET
          stock = seller_catalog_variants.stock + EXCLUDED.stock,
          updated_at = now();
        
        v_total_variantes_creadas := v_total_variantes_creadas + 1;
      
      -- Si NO tiene variant_id pero tiene SKU, intentar encontrarlo
      ELSIF v_grupo.skus[i] IS NOT NULL THEN
        
        -- Buscar variant_id por SKU y source_product_id
        SELECT pv.id INTO v_variant_record
        FROM product_variants pv
        WHERE pv.product_id = v_grupo.source_product_id
          AND pv.sku = v_grupo.skus[i]
        LIMIT 1;
        
        IF FOUND THEN
          INSERT INTO seller_catalog_variants (
            seller_catalog_id,
            variant_id,
            sku,
            stock,
            is_available,
            created_at
          )
          VALUES (
            v_catalog_id,
            v_variant_record.id,
            v_grupo.skus[i],
            COALESCE(v_grupo.stocks[i], 0),
            true,
            now()
          )
          ON CONFLICT (seller_catalog_id, variant_id) 
          DO UPDATE SET
            stock = seller_catalog_variants.stock + EXCLUDED.stock,
            updated_at = now();
          
          v_total_variantes_creadas := v_total_variantes_creadas + 1;
        END IF;
      END IF;
    END LOOP;
    
    -- Si hay más de 1 registro, eliminar los duplicados (menos el primero)
    IF array_length(v_grupo.ids, 1) > 1 THEN
      DELETE FROM seller_catalog
      WHERE id = ANY(v_grupo.ids[2:]);
      
      v_total_consolidados := v_total_consolidados + (array_length(v_grupo.ids, 1) - 1);
    END IF;
    
  END LOOP;
  
  RAISE NOTICE '✅ Consolidados: % registros duplicados eliminados', v_total_consolidados;
  RAISE NOTICE '✅ Variantes creadas: % registros en seller_catalog_variants', v_total_variantes_creadas;
  
END $$;

SELECT '✅ PASO 2: Datos migrados a nueva estructura' as resultado;

-- =============================================================================
-- PASO 3: Limpiar seller_catalog (remover campos obsoletos)
-- =============================================================================
-- Ya no necesitamos variant_id ni stock en seller_catalog
-- El stock ahora está en seller_catalog_variants

-- Primero, verificar que todas las variantes fueron migradas
SELECT 
  '🔍 VERIFICACIÓN: Registros con variant_id que deben tener variantes' as info,
  COUNT(*) as total,
  COUNT(DISTINCT sc.id) as productos_unicos
FROM seller_catalog sc
WHERE sc.variant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seller_catalog_variants scv
    WHERE scv.seller_catalog_id = sc.id
  );

-- Remover columnas obsoletas (OPCIONAL - comentado por seguridad)
-- Solo descomenta esto después de verificar que todo funciona correctamente

/*
ALTER TABLE seller_catalog 
  DROP COLUMN IF EXISTS variant_id,
  DROP COLUMN IF EXISTS stock,
  DROP COLUMN IF EXISTS sku;
  
SELECT '✅ PASO 3: Columnas obsoletas removidas' as resultado;
*/

SELECT '⚠️ PASO 3: Columnas obsoletas NO removidas (por seguridad)' as resultado;
SELECT '   Descomenta la sección después de verificar que todo funciona' as nota;

-- =============================================================================
-- PASO 4: Crear vista para queries B2C (facilitar consultas)
-- =============================================================================

CREATE OR REPLACE VIEW v_seller_catalog_with_variants AS
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
  SUM(scv.stock) as total_stock,
  json_agg(
    json_build_object(
      'variant_id', scv.id,
      'product_variant_id', scv.variant_id,
      'sku', scv.sku,
      'stock', scv.stock,
      'precio', COALESCE(scv.precio_override, pv.precio),
      'is_available', scv.is_available,
      'attributes', pv.attributes
    ) ORDER BY scv.created_at
  ) FILTER (WHERE scv.id IS NOT NULL) as variantes,
  
  -- Rango de precios
  MIN(COALESCE(scv.precio_override, pv.precio)) as precio_min,
  MAX(COALESCE(scv.precio_override, pv.precio)) as precio_max,
  
  -- Estado de disponibilidad
  BOOL_OR(scv.is_available) as tiene_variantes_disponibles
  
FROM seller_catalog sc
LEFT JOIN products p ON p.id = sc.source_product_id
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
LEFT JOIN product_variants pv ON pv.id = scv.variant_id
WHERE sc.source_product_id IS NOT NULL
GROUP BY 
  sc.id, sc.seller_store_id, sc.source_product_id, sc.nombre, 
  sc.descripcion, sc.images, sc.is_active, sc.imported_at,
  p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes;

SELECT '✅ PASO 4: Vista v_seller_catalog_with_variants creada' as resultado;

-- =============================================================================
-- PASO 5: Actualizar trigger auto_add_to_seller_catalog_on_complete
-- =============================================================================
-- Modificar para que cree estructura correcta (producto + variantes)

CREATE OR REPLACE FUNCTION auto_add_to_seller_catalog_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_store_id UUID;
  v_catalog_id UUID;
  v_existing_variant UUID;
BEGIN
  -- Solo ejecutar si el pedido se completa o entrega
  IF NEW.status IN ('completed', 'delivered') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
    
    -- Obtener seller_store_id del comprador
    SELECT seller_store_id INTO v_store_id
    FROM buyer_profiles
    WHERE id = NEW.buyer_id
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
            -- Actualizar stock de variante existente
            UPDATE seller_catalog_variants
            SET 
              stock = stock + v_item.cantidad,
              is_available = true,
              updated_at = now()
            WHERE id = v_existing_variant;
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
          END IF;
          
        END IF;
        
      END LOOP;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger (por si ya existía)
DROP TRIGGER IF EXISTS trigger_auto_add_to_seller_catalog_on_complete ON orders_b2b;

CREATE TRIGGER trigger_auto_add_to_seller_catalog_on_complete
  AFTER UPDATE ON orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_seller_catalog_on_complete();

SELECT '✅ PASO 5: Trigger actualizado para nueva arquitectura' as resultado;

-- =============================================================================
-- PASO 6: Row Level Security (RLS) Policies
-- =============================================================================

-- Habilitar RLS en la nueva tabla
ALTER TABLE seller_catalog_variants ENABLE ROW LEVEL SECURITY;

-- Policy: Los vendedores pueden ver sus propias variantes
CREATE POLICY seller_catalog_variants_select_own
  ON seller_catalog_variants
  FOR SELECT
  USING (
    seller_catalog_id IN (
      SELECT id FROM seller_catalog 
      WHERE seller_store_id IN (
        SELECT seller_store_id FROM buyer_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Todos pueden ver variantes de productos activos (para B2C)
CREATE POLICY seller_catalog_variants_select_public
  ON seller_catalog_variants
  FOR SELECT
  USING (
    is_available = true
    AND seller_catalog_id IN (
      SELECT id FROM seller_catalog 
      WHERE is_active = true
    )
  );

-- Policy: Los vendedores pueden actualizar sus propias variantes
CREATE POLICY seller_catalog_variants_update_own
  ON seller_catalog_variants
  FOR UPDATE
  USING (
    seller_catalog_id IN (
      SELECT id FROM seller_catalog 
      WHERE seller_store_id IN (
        SELECT seller_store_id FROM buyer_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Los vendedores pueden eliminar sus propias variantes
CREATE POLICY seller_catalog_variants_delete_own
  ON seller_catalog_variants
  FOR DELETE
  USING (
    seller_catalog_id IN (
      SELECT id FROM seller_catalog 
      WHERE seller_store_id IN (
        SELECT seller_store_id FROM buyer_profiles 
        WHERE id = auth.uid()
      )
    )
  );

SELECT '✅ PASO 6: RLS Policies creadas' as resultado;

-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- Ver resumen de la migración
SELECT '📊 RESUMEN FINAL' as info;

SELECT 
  '🏪 Productos en seller_catalog' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog
WHERE source_product_id IS NOT NULL;

SELECT 
  '🎨 Variantes en seller_catalog_variants' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;

SELECT 
  '📦 Stock total en variantes' as metrica,
  SUM(stock) as cantidad
FROM seller_catalog_variants;

-- Ver productos con sus variantes
SELECT 
  '🔍 PRODUCTOS CON VARIANTES' as info,
  sc.id as catalog_id,
  sc.nombre as producto,
  COUNT(scv.id) as total_variantes,
  SUM(scv.stock) as stock_total,
  array_agg(scv.sku) as skus
FROM seller_catalog sc
LEFT JOIN seller_catalog_variants scv ON scv.seller_catalog_id = sc.id
WHERE sc.source_product_id IS NOT NULL
GROUP BY sc.id, sc.nombre
ORDER BY COUNT(scv.id) DESC
LIMIT 10;

SELECT '✅✅✅ MIGRACIÓN COMPLETADA ✅✅✅' as resultado;
