-- =============================================================================
-- FIX: v_business_panel_data — usa calculate_shipping_cost_cart() igual que
--      get_catalog_fastest_shipping_cost_by_product y el carrito
-- =============================================================================
-- Lógica:
--   1. Obtener shipping_route_id del mercado configurado en stores del usuario
--      (stores.market_id → markets.shipping_route_id)
--   2. LATERAL JOIN a calculate_shipping_cost_cart(route_id, weight_kg)
--      → mismo motor que catálogo y carrito, sin fórmulas duplicadas
--   3. Si no hay ruta (mercado no configurado) → sc.* = NULL
--      → frontend muestra advertencia en lugar del análisis
--
-- Fecha: 2026-02-22
-- =============================================================================

DROP VIEW IF EXISTS public.v_business_panel_data CASCADE;

CREATE OR REPLACE VIEW public.v_business_panel_data AS

WITH user_route AS (
  -- Ruta de envío del mercado configurado en la tienda del usuario (auth.uid())
  SELECT m.shipping_route_id AS route_id
  FROM   public.stores s
  JOIN   public.markets m ON s.market_id = m.id
  WHERE  s.owner_user_id       = auth.uid()
    AND  s.market_id           IS NOT NULL
    AND  m.shipping_route_id   IS NOT NULL
    AND  m.is_active           = TRUE
  LIMIT 1
)

-- ─────────────────────────────────────────────────────────────────
-- RAMA 1: PRODUCTOS (sin variante)
-- ─────────────────────────────────────────────────────────────────
SELECT
  vp.id                           AS product_id,
  NULL::uuid                      AS variant_id,
  vp.nombre                       AS item_name,
  vp.sku_interno                  AS sku,
  'product'                       AS item_type,
  vp.precio_b2b                   AS cost_per_unit,

  -- Peso desde v_logistics_data (COALESCE peso_g/peso_kg ✅)
  COALESCE(ld.weight_kg, 0)       AS weight_kg,

  -- Costo de envío: mismo motor que catálogo y carrito
  sc.total_cost_with_type         AS shipping_cost_per_unit,

  -- PVP sugerido = precio_b2b + costo_envío
  CASE WHEN sc.total_cost_with_type IS NOT NULL
    THEN ROUND((vp.precio_b2b + sc.total_cost_with_type)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vp.precio_b2b                   AS investment_1unit,

  CASE WHEN sc.total_cost_with_type IS NOT NULL
    THEN ROUND((vp.precio_b2b + sc.total_cost_with_type)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  sc.total_cost_with_type         AS profit_1unit,

  CASE WHEN sc.total_cost_with_type IS NOT NULL AND vp.precio_b2b > 0
    THEN ROUND((sc.total_cost_with_type / vp.precio_b2b * 100)::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vp.is_active,
  NOW()                           AS last_updated

FROM public.v_productos_con_precio_b2b vp
LEFT JOIN public.v_logistics_data ld
       ON vp.id = ld.product_id AND ld.variant_id IS NULL
LEFT JOIN LATERAL (
  SELECT total_cost_with_type
  FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM user_route LIMIT 1)::UUID,
    COALESCE(ld.weight_kg, 0)::NUMERIC,
    NULL::UUID, FALSE, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
    'standard'
  )
) sc ON (SELECT route_id FROM user_route LIMIT 1) IS NOT NULL
WHERE vp.is_active = TRUE

UNION ALL

-- ─────────────────────────────────────────────────────────────────
-- RAMA 2: VARIANTES
-- ─────────────────────────────────────────────────────────────────
SELECT
  vv.product_id,
  vv.id                           AS variant_id,
  vv.name                         AS item_name,
  vv.sku                          AS sku,
  'variant'                       AS item_type,
  vv.precio_b2b_final             AS cost_per_unit,

  COALESCE(ld.weight_kg, 0)       AS weight_kg,

  sc.total_cost_with_type         AS shipping_cost_per_unit,

  CASE WHEN sc.total_cost_with_type IS NOT NULL
    THEN ROUND((vv.precio_b2b_final + sc.total_cost_with_type)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vv.precio_b2b_final             AS investment_1unit,

  CASE WHEN sc.total_cost_with_type IS NOT NULL
    THEN ROUND((vv.precio_b2b_final + sc.total_cost_with_type)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  sc.total_cost_with_type         AS profit_1unit,

  CASE WHEN sc.total_cost_with_type IS NOT NULL AND vv.precio_b2b_final > 0
    THEN ROUND((sc.total_cost_with_type / vv.precio_b2b_final * 100)::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vv.is_active,
  NOW()                           AS last_updated

FROM public.v_variantes_con_precio_b2b vv
LEFT JOIN public.v_logistics_data ld ON vv.id = ld.variant_id
LEFT JOIN LATERAL (
  SELECT total_cost_with_type
  FROM public.calculate_shipping_cost_cart(
    (SELECT route_id FROM user_route LIMIT 1)::UUID,
    COALESCE(ld.weight_kg, 0)::NUMERIC,
    NULL::UUID, FALSE, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
    'standard'
  )
) sc ON (SELECT route_id FROM user_route LIMIT 1) IS NOT NULL
WHERE vv.is_active = TRUE;

-- Permisos
GRANT SELECT ON public.v_business_panel_data TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- SELECT item_name, sku, weight_kg, shipping_cost_per_unit
-- FROM v_business_panel_data
-- LIMIT 10;
--
-- Si shipping_cost_per_unit = NULL → usuario sin mercado/ruta configurada
--   → frontend muestra advertencia, NO el análisis de costos.
-- Si shipping_cost_per_unit > 0  → ruta encontrada, mostrar análisis.
--
-- Diagnóstico cuando es NULL:
--   1. Verificar stores.market_id asignado para el usuario
--   2. Verificar markets.shipping_route_id no es NULL y is_active = TRUE
--   3. Verificar shipping_tiers tiene un tier 'standard' activo para esa ruta
-- =============================================================================
