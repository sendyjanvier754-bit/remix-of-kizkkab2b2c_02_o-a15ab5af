-- =============================================================================
-- VISTA: v_business_panel_data
-- =============================================================================
-- Descripción:
--   Vista unificada que combina PRODUCTOS y VARIANTES con todos los cálculos
--   del BusinessPanel (Panel de Negocio) en un solo lugar.
--
-- Propósito:
--   Centralizar los datos de precios y márgenes para usar en:
--   - VariantDrawer (selección de variantes)
--   - SellerCartPage (resumen del pedido)
--   - Cualquier otra vista que necesite BusinessPanel
--
-- Fórmula de Margen:
--   - PVP sugerido = Precio B2B × 2.5 (150% de margen)
--   - Ganancia unitaria = PVP sugerido - Precio B2B
--   - Margen % = (Ganancia / Precio B2B) × 100
--
-- Última Actualización: 2026-02-06
-- =============================================================================

-- Limpiar vistas anteriores si existen
DROP VIEW IF EXISTS v_product_business_panel CASCADE;
DROP VIEW IF EXISTS v_variant_business_panel CASCADE;

-- Crear vista unificada
CREATE OR REPLACE VIEW v_business_panel_data AS

-- ========== RAMA 1: PRODUCTOS ==========
SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  (vp.precio_b2b * 2.5) as suggested_pvp_per_unit,
  vp.precio_b2b as investment_1unit,
  (vp.precio_b2b * 2.5) as revenue_1unit,
  ((vp.precio_b2b * 2.5) - vp.precio_b2b) as profit_1unit,
  CASE 
    WHEN vp.precio_b2b > 0 THEN (((vp.precio_b2b * 2.5) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  vp.is_active,
  NOW() as last_updated
FROM v_productos_con_precio_b2b vp
WHERE vp.is_active = TRUE

UNION ALL

-- ========== RAMA 2: VARIANTES ==========
SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.name as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  (vv.precio_b2b_final * 2.5) as suggested_pvp_per_unit,
  vv.precio_b2b_final as investment_1unit,
  (vv.precio_b2b_final * 2.5) as revenue_1unit,
  ((vv.precio_b2b_final * 2.5) - vv.precio_b2b_final) as profit_1unit,
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN (((vv.precio_b2b_final * 2.5) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  vv.is_active,
  NOW() as last_updated
FROM v_variantes_con_precio_b2b vv
WHERE vv.is_active = TRUE;

-- Comentario descriptivo
COMMENT ON VIEW v_business_panel_data IS 'Unified view combining products and variants with BusinessPanel metrics (cost_per_unit, suggested_pvp, profit, margin). All metrics calculated for 1 unit. Use functions to multiply by quantity.';

-- =============================================================================
-- EJEMPLO DE USO
-- =============================================================================

-- Ver todos los productos con su información de negocio
-- SELECT * FROM v_business_panel_data WHERE item_type = 'product' LIMIT 5;

-- Ver todas las variantes
-- SELECT * FROM v_business_panel_data WHERE item_type = 'variant' LIMIT 5;

-- Ver un producto específico
-- SELECT * FROM v_business_panel_data WHERE product_id = 'uuid-producto';

-- Ver variantes de un producto
-- SELECT * FROM v_business_panel_data WHERE product_id = 'uuid-producto' AND item_type = 'variant';

-- =============================================================================
-- CAMPOS DISPONIBLES
-- =============================================================================
-- product_id              UUID      - ID del producto (NULL si es variante)
-- variant_id              UUID      - ID de la variante (NULL si es producto)
-- item_name               TEXT      - Nombre del producto o variante
-- sku                     TEXT      - SKU del item
-- item_type               TEXT      - Tipo: 'product' o 'variant'
-- cost_per_unit           NUMERIC   - Precio B2B unitario (lo que pagas)
-- suggested_pvp_per_unit  NUMERIC   - PVP sugerido = cost × 2.5
-- investment_1unit        NUMERIC   - Inversión para 1 unidad (= cost_per_unit)
-- revenue_1unit           NUMERIC   - Ingresos para 1 unidad (= suggested_pvp)
-- profit_1unit            NUMERIC   - Ganancia para 1 unidad
-- margin_percentage       NUMERIC   - Margen % (150% para todos)
-- is_active               BOOLEAN   - Activo en el sistema
-- last_updated            TIMESTAMP - Fecha de último cálculo
-- =============================================================================
