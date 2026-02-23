-- =============================================================================
-- FIX: v_business_panel_data — fórmula PVP Sugerido
--
-- Fórmula corregida:
--   PVP Sugerido  = precio_B2B × 3 + costo_envío
--   Ganancia      = precio_B2B × 2  (= PVP − B2B − envío)
--   Margen %      = ganancia / PVP × 100
--
-- Fecha: 2026-02-22
-- =============================================================================

DROP VIEW IF EXISTS public.v_business_panel_data;

CREATE OR REPLACE VIEW public.v_business_panel_data AS

WITH user_country AS (
  SELECT m.destination_country_id AS country_id
  FROM   public.stores s
  JOIN   public.markets m ON s.market_id = m.id
  WHERE  s.owner_user_id          = auth.uid()
    AND  s.market_id              IS NOT NULL
    AND  m.destination_country_id IS NOT NULL
    AND  m.is_active              = TRUE
  LIMIT 1
)

-- ─── RAMA 1: PRODUCTOS (sin variante) ────────────────────────────────────────
SELECT
  vp.id                           AS product_id,
  NULL::uuid                      AS variant_id,
  vp.nombre                       AS item_name,
  vp.sku_interno                  AS sku,
  'product'                       AS item_type,
  vp.precio_b2b                   AS cost_per_unit,
  COALESCE(ld.weight_kg, 0)       AS weight_kg,
  sc.shipping_cost_usd            AS shipping_cost_per_unit,

  -- PVP Sugerido = precio_B2B × 3 + costo_envío
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vp.precio_b2b                   AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  -- Ganancia = PVP − B2B − envío = B2B × 2
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  -- Margen % = ganancia / PVP × 100
  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b > 0
    THEN ROUND((
      (vp.precio_b2b * 2)
      / (vp.precio_b2b * 3 + sc.shipping_cost_usd)
      * 100
    )::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vp.is_active,
  NOW()                           AS last_updated

FROM public.v_productos_con_precio_b2b vp
LEFT JOIN public.v_logistics_data ld
       ON vp.id = ld.product_id AND ld.variant_id IS NULL
LEFT JOIN LATERAL (
  SELECT shipping_cost_usd
  FROM public.get_product_shipping_cost_by_country(
    vp.id,
    (SELECT country_id FROM user_country LIMIT 1),
    'standard'
  )
  LIMIT 1
) sc ON (SELECT country_id FROM user_country LIMIT 1) IS NOT NULL
WHERE vp.is_active = TRUE

UNION ALL

-- ─── RAMA 2: VARIANTES ───────────────────────────────────────────────────────
SELECT
  vv.product_id,
  vv.id                           AS variant_id,
  vv.name                         AS item_name,
  vv.sku                          AS sku,
  'variant'                       AS item_type,
  vv.precio_b2b_final             AS cost_per_unit,
  COALESCE(ld.weight_kg, 0)       AS weight_kg,
  sc.shipping_cost_usd            AS shipping_cost_per_unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vv.precio_b2b_final             AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final > 0
    THEN ROUND((
      (vv.precio_b2b_final * 2)
      / (vv.precio_b2b_final * 3 + sc.shipping_cost_usd)
      * 100
    )::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vv.is_active,
  NOW()                           AS last_updated

FROM public.v_variantes_con_precio_b2b vv
LEFT JOIN public.v_logistics_data ld ON vv.id = ld.variant_id
LEFT JOIN LATERAL (
  SELECT shipping_cost_usd
  FROM public.get_product_shipping_cost_by_country(
    vv.product_id,
    (SELECT country_id FROM user_country LIMIT 1),
    'standard'
  )
  LIMIT 1
) sc ON (SELECT country_id FROM user_country LIMIT 1) IS NOT NULL
WHERE vv.is_active = TRUE;

GRANT SELECT ON public.v_business_panel_data TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN rápida (ejecutar después):
-- SELECT item_name, cost_per_unit, shipping_cost_per_unit,
--        suggested_pvp_per_unit, profit_1unit, margin_percentage
-- FROM v_business_panel_data
-- LIMIT 5;
--
-- Ejemplo con B2B=$5.72, envío=$8.11:
--   suggested_pvp = 5.72×3 + 8.11 = $25.27
--   profit        = 5.72×2        = $11.44
--   margin        = 11.44/25.27   = 45.3%
-- =============================================================================
