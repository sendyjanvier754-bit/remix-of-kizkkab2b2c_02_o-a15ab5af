-- ============================================================================
-- MIGRACIÓN: CAMBIO DE PESO_KG A PESO_G (GRAMOS)
-- ============================================================================
-- Cambia el almacenamiento de peso de kilogramos a gramos para mayor precisión
-- Actualiza datos existentes multiplicando por 1000
-- Verifica que módulo de logística B2B usa correctamente las conversiones
-- ============================================================================

-- 1. Agregar nueva columna peso_g (gramos)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS peso_g INTEGER;

-- 2. Migrar datos existentes de peso_kg a peso_g
UPDATE products
SET peso_g = CASE
  WHEN peso_kg IS NOT NULL AND peso_kg > 0 THEN ROUND(peso_kg * 1000)::INTEGER
  ELSE NULL
END
WHERE peso_g IS NULL;

-- 3. Crear índice para productos sin peso (alerta)
CREATE INDEX IF NOT EXISTS idx_products_missing_peso 
  ON products(id) 
  WHERE peso_g IS NULL OR peso_g = 0;

-- 4. Agregar constraint para validar peso positivo (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_peso_g_positive'
  ) THEN
    ALTER TABLE products 
      ADD CONSTRAINT chk_peso_g_positive 
      CHECK (peso_g IS NULL OR peso_g > 0);
  END IF;
END $$;

-- 5. Agregar comentario descriptivo
COMMENT ON COLUMN products.peso_g IS 'Peso del producto en gramos. Usado por el módulo de logística B2B para cálculo de costos de envío. IMPORTANTE: El módulo convierte g → kg → lb según la zona.';

-- 6. Vista: Productos sin peso (para alertas)
CREATE OR REPLACE VIEW v_products_without_weight AS
SELECT 
  p.id,
  p.sku_interno,
  p.nombre,
  p.categoria_id,
  c.name as categoria_nombre,
  p.proveedor_id,
  s.name as proveedor_nombre,
  p.stock_fisico,
  p.is_active,
  p.created_at,
  p.updated_at
FROM products p
LEFT JOIN categories c ON p.categoria_id = c.id
LEFT JOIN suppliers s ON p.proveedor_id = s.id
WHERE (p.peso_g IS NULL OR p.peso_g = 0)
  AND p.is_active = true
ORDER BY p.created_at DESC;

-- 7. Función: Validar peso antes de cálculo de envío
CREATE OR REPLACE FUNCTION validate_product_weight(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_peso_g INTEGER;
  v_product_name TEXT;
BEGIN
  SELECT peso_g, nombre INTO v_peso_g, v_product_name
  FROM products
  WHERE id = p_product_id;

  IF v_peso_g IS NULL OR v_peso_g = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'MISSING_WEIGHT',
      'message', format('Producto "%s" no tiene peso configurado. Configure el peso en gramos.', v_product_name),
      'product_id', p_product_id,
      'product_name', v_product_name
    );
  END IF;

  IF v_peso_g < 1 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'INVALID_WEIGHT',
      'message', format('Producto "%s" tiene peso inválido (%s g). El peso debe ser mayor a 0.', v_product_name, v_peso_g),
      'product_id', p_product_id,
      'peso_g', v_peso_g
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'peso_g', v_peso_g,
    'peso_kg', ROUND((v_peso_g / 1000.0)::numeric, 3),
    'peso_lb', ROUND((v_peso_g / 453.592)::numeric, 3)
  );
END;
$$;

-- 8. Actualizar función calculate_b2b_price_multitramo para validar peso
-- Primero eliminar todas las versiones existentes
DROP FUNCTION IF EXISTS calculate_b2b_price_multitramo(UUID, INTEGER, VARCHAR, UUID);
DROP FUNCTION IF EXISTS calculate_b2b_price_multitramo(UUID, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS calculate_b2b_price_multitramo;

CREATE OR REPLACE FUNCTION calculate_b2b_price_multitramo(
  p_product_id UUID,
  p_quantity INTEGER,
  p_destination_country_code VARCHAR(2),
  p_shipping_zone_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_zone RECORD;
  v_tier RECORD;
  v_peso_g INTEGER;
  v_peso_kg NUMERIC;
  v_peso_lb NUMERIC;
  v_total_peso_g NUMERIC;
  v_total_peso_kg NUMERIC;
  v_total_peso_lb NUMERIC;
  v_billable_peso_kg NUMERIC;
  v_billable_peso_lb NUMERIC;
  v_shipping_cost NUMERIC := 0;
  v_subtotal NUMERIC;
  v_total NUMERIC;
BEGIN
  -- 1. Validar peso del producto PRIMERO
  SELECT peso_g INTO v_peso_g FROM products WHERE id = p_product_id;
  
  IF v_peso_g IS NULL OR v_peso_g = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_WEIGHT',
      'message', 'Este producto no tiene peso configurado y no puede ser enviado. Contacte al vendedor.'
    );
  END IF;

  -- 2. Obtener información del producto
  SELECT 
    p.*,
    COALESCE(p.precio_mayorista, 0) as precio_base
  INTO v_product
  FROM products p
  WHERE p.id = p_product_id;

  IF v_product IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
  END IF;

  -- 3. Calcular peso total del pedido (g)
  v_total_peso_g := v_peso_g * p_quantity;
  
  -- Aplicar peso facturable mínimo = 200g POR PRODUCTO
  IF v_peso_g < 200 THEN
    v_peso_g := 200;  -- Facturable mínimo por producto = 200g
    v_total_peso_g := v_peso_g * p_quantity;
  END IF;

  -- 4. Conversiones con CEIL (redondeo superior) aplicado al TOTAL
  v_peso_kg := (v_peso_g / 1000.0)::numeric;  -- Peso unitario en kg (para referencia)
  v_peso_lb := (v_peso_g / 453.592)::numeric; -- Peso unitario en lb (para referencia)
  
  v_billable_peso_kg := CEIL((v_total_peso_g / 1000.0)::numeric);  -- ✅ CEIL al total en kg
  v_billable_peso_lb := CEIL((v_total_peso_g / 453.592)::numeric); -- ✅ CEIL al total en lb

  -- 5. Obtener zona de envío
  IF p_shipping_zone_id IS NOT NULL THEN
    SELECT * INTO v_zone FROM shipping_zones WHERE id = p_shipping_zone_id;
  ELSE
    SELECT * INTO v_zone 
    FROM shipping_zones 
    WHERE origin_country = 'CN' 
      AND destination_country = p_destination_country_code
    LIMIT 1;
  END IF;

  IF v_zone IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_COVERAGE',
      'message', 'Sin cobertura logística en esta zona',
      'destination_country', p_destination_country_code
    );
  END IF;
    -- 6. Obtener tier de envío según peso (en unidad configurada en zona)
    SELECT * INTO v_tier
    FROM shipping_tiers
    WHERE zone_id = v_zone.id
      AND (
        (v_zone.weight_unit = 'kg' AND v_total_peso_kg BETWEEN min_weight AND max_weight)
        OR (v_zone.weight_unit = 'lb' AND v_total_peso_lb BETWEEN min_weight AND max_weight)
        OR (v_zone.weight_unit = 'g' AND v_total_peso_g BETWEEN min_weight AND max_weight)
      )
    ORDER BY min_weight DESC
    LIMIT 1;

    -- 7. Calcular costo de envío
    IF v_tier IS NOT NULL THEN
      IF v_zone.weight_unit = 'kg' THEN
        v_shipping_cost := v_tier.cost_per_unit * v_total_peso_kg;
      ELSIF v_zone.weight_unit = 'lb' THEN
        v_shipping_cost := v_tier.cost_per_unit * v_total_peso_lb;
      ELSIF v_zone.weight_unit = 'g' THEN
        v_shipping_cost := v_tier.cost_per_unit * v_total_peso_g;
      END IF;
    ELSE
      -- Sin tier, usar costo base de zona
      IF v_zone.weight_unit = 'kg' THEN
        v_shipping_cost := COALESCE(v_zone.base_cost_per_kg, 7.0) * v_total_peso_kg;
      ELSIF v_zone.weight_unit = 'lb' THEN
        v_shipping_cost := COALESCE(v_zone.base_cost_per_kg, 7.0) * v_total_peso_lb;
      ELSE
        v_shipping_cost := COALESCE(v_zone.base_cost_per_kg, 7.0) * v_total_peso_kg;
      END IF;
    END IF;

  -- 8. Calcular totales
  v_subtotal := v_product.precio_base * p_quantity;
  v_total := v_subtotal + v_shipping_cost;

  -- 9. Retornar resultado completo
  RETURN jsonb_build_object(
    'success', true,
    'product', jsonb_build_object(
      'id', v_product.id,
      'sku', v_product.sku_interno,
      'nombre', v_product.nombre,
      'precio_unitario', v_product.precio_base,
      'peso_g', v_peso_g,
      'peso_kg', v_peso_kg,
      'peso_lb', v_peso_lb
    ),
    'order', jsonb_build_object(
      'quantity', p_quantity,
      'subtotal', ROUND(v_subtotal, 2),
      'total_peso_g', v_peso_g * p_quantity,
      'total_peso_kg', v_peso_kg * p_quantity,
      'total_peso_lb', v_peso_lb * p_quantity
    ),
    'shipping', jsonb_build_object(
      'zone_id', v_zone.id,
      'zone_name', v_zone.name,
      'route', format('%s → %s', v_zone.origin_country, v_zone.destination_country),
      'weight_unit', v_zone.weight_unit,
      'tier_id', v_tier.id,
      'tier_name', v_tier.name,
      'cost', ROUND(v_shipping_cost, 2),
      'delivery_days', v_zone.estimated_delivery_days
    ),
    'total', ROUND(v_total, 2)
  );
END;
$$;

-- 9. RLS Policy para la vista
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_without_weight_read ON products;
CREATE POLICY products_without_weight_read ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'seller')
    )
  );

-- 10. Permisos
GRANT SELECT ON v_products_without_weight TO authenticated;
GRANT EXECUTE ON FUNCTION validate_product_weight TO authenticated;

-- 11. Estadísticas de migración
DO $$
DECLARE
  v_total_products INTEGER;
  v_with_weight INTEGER;
  v_without_weight INTEGER;
  v_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_products FROM products WHERE is_active = true;
  SELECT COUNT(*) INTO v_with_weight FROM products WHERE peso_g > 0 AND is_active = true;
  SELECT COUNT(*) INTO v_without_weight FROM products WHERE (peso_g IS NULL OR peso_g = 0) AND is_active = true;
  SELECT COUNT(*) INTO v_migrated FROM products WHERE peso_kg IS NOT NULL AND peso_g > 0;

  RAISE NOTICE '=== MIGRACIÓN PESO_KG → PESO_G ===';
  RAISE NOTICE 'Total productos activos: %', v_total_products;
  RAISE NOTICE 'Con peso configurado: % (%.1f%%)', v_with_weight, (v_with_weight::float / NULLIF(v_total_products, 0) * 100);
  RAISE NOTICE 'Sin peso (REQUIEREN ATENCIÓN): % (%.1f%%)', v_without_weight, (v_without_weight::float / NULLIF(v_total_products, 0) * 100);
  RAISE NOTICE 'Migrados de peso_kg: %', v_migrated;
  RAISE NOTICE '================================';
END $$;

-- 12. Comentarios finales
COMMENT ON VIEW v_products_without_weight IS 'Productos activos sin peso configurado. Usar para generar alertas en UI.';
COMMENT ON FUNCTION validate_product_weight IS 'Valida que un producto tenga peso configurado antes de cálculo de envío';
COMMENT ON FUNCTION calculate_b2b_price_multitramo IS 'Calcula precio B2B con envío multitramo. ACTUALIZADO: Valida peso en gramos y convierte a kg/lb según zona.';
