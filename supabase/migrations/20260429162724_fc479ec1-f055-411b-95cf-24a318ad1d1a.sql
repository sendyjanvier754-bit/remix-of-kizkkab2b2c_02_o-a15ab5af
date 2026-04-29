-- Restore v_productos_precio_base (alias)
DROP VIEW IF EXISTS public.v_productos_precio_base CASCADE;
CREATE VIEW public.v_productos_precio_base AS
SELECT * FROM public.v_productos_con_precio_b2b;

GRANT SELECT ON public.v_productos_precio_base TO anon, authenticated;

-- Restore v_business_panel_data
DROP VIEW IF EXISTS public.v_business_panel_data CASCADE;

CREATE VIEW public.v_business_panel_data AS
WITH route_config AS (
  SELECT 
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb
  FROM public.shipping_tiers st
  WHERE st.tier_type = 'STANDARD' AND st.is_active = TRUE
  LIMIT 1
),
zone_config AS (
  SELECT final_delivery_surcharge
  FROM public.shipping_zones
  WHERE zone_name = 'HAITI_CENTRO' AND is_active = TRUE
  LIMIT 1
)
-- ========== PRODUCTOS ==========
SELECT
  vp.id AS product_id,
  NULL::uuid AS variant_id,
  vp.nombre AS item_name,
  vp.sku_interno AS sku,
  'product' AS item_type,
  vp.precio_b2b AS cost_per_unit,
  COALESCE(ld.weight_kg, 0) AS weight_kg,
  (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0)) AS shipping_cost_per_unit,
  ((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) AS suggested_pvp_per_unit,
  vp.precio_b2b AS investment_1unit,
  ((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) AS revenue_1unit,
  (((vp.precio_b2b * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vp.precio_b2b) AS profit_1unit,
  CASE 
    WHEN vp.precio_b2b > 0 THEN ((((vp.precio_b2b * 2.5) + 
      (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
      + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
      + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END AS margin_percentage,
  vp.is_active,
  NOW() AS last_updated
FROM public.v_productos_con_precio_b2b vp
LEFT JOIN public.v_logistics_data ld ON vp.id = ld.product_id AND ld.variant_id IS NULL
WHERE vp.is_active = TRUE

UNION ALL

-- ========== VARIANTES ==========
SELECT
  vv.product_id,
  vv.id AS variant_id,
  vv.name AS item_name,
  vv.sku AS sku,
  'variant' AS item_type,
  vv.precio_b2b_final AS cost_per_unit,
  COALESCE(ld.weight_kg, 0) AS weight_kg,
  (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0)) AS shipping_cost_per_unit,
  ((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) AS suggested_pvp_per_unit,
  vv.precio_b2b_final AS investment_1unit,
  ((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) AS revenue_1unit,
  (((vv.precio_b2b_final * 2.5) + 
    (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
    + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
    + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vv.precio_b2b_final) AS profit_1unit,
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN ((((vv.precio_b2b_final * 2.5) + 
      (COALESCE(ld.weight_kg, 0) * (SELECT tramo_a_cost_per_kg FROM route_config)
      + COALESCE(ld.weight_kg, 0) * 2.20462 * (SELECT tramo_b_cost_per_lb FROM route_config)
      + COALESCE((SELECT final_delivery_surcharge FROM zone_config), 0))) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)::numeric(10,1)
    ELSE 0::numeric(10,1)
  END AS margin_percentage,
  vv.is_active,
  NOW() AS last_updated
FROM public.v_variantes_con_precio_b2b vv
LEFT JOIN public.v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

GRANT SELECT ON public.v_business_panel_data TO anon, authenticated;

COMMENT ON VIEW public.v_business_panel_data IS 
  'Business panel with shipping cost per unit using REAL weight (no rounding). Weight rounding ONLY happens at cart total level.';