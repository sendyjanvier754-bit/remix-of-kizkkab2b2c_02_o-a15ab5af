-- Create unified view for BusinessPanel data calculations
-- This view consolidates products and variants with all business metrics in one place

-- DROP old views if they exist
DROP VIEW IF EXISTS v_product_business_panel CASCADE;
DROP VIEW IF EXISTS v_variant_business_panel CASCADE;

-- Main unified view: BusinessPanel data for products and variants
-- Includes metrics for 1 unit and calculations for any quantity
CREATE OR REPLACE VIEW v_business_panel_data AS
-- PRODUCTS BRANCH
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
    WHEN vp.precio_b2b > 0 THEN (((vp.precio_b2b * 2.5) - vp.precio_b2b) / vp.precio_b2b * 100)
    ELSE 0
  END::numeric(10,1) as margin_percentage,
  vp.is_active,
  NOW() as last_updated
FROM v_productos_con_precio_b2b vp
WHERE vp.is_active = TRUE

UNION ALL

-- VARIANTS BRANCH
SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.nombre as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  (vv.precio_b2b_final * 2.5) as suggested_pvp_per_unit,
  vv.precio_b2b_final as investment_1unit,
  (vv.precio_b2b_final * 2.5) as revenue_1unit,
  ((vv.precio_b2b_final * 2.5) - vv.precio_b2b_final) as profit_1unit,
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN (((vv.precio_b2b_final * 2.5) - vv.precio_b2b_final) / vv.precio_b2b_final * 100)
    ELSE 0
  END::numeric(10,1) as margin_percentage,
  vv.is_active,
  NOW() as last_updated
FROM v_variantes_con_precio_b2b vv
WHERE vv.is_active = TRUE;

-- Function: Get BusinessPanel metrics for any product or variant with multiplied quantity
-- Usage: 
--   SELECT * FROM get_business_panel_metrics('product-uuid', NULL, 10)
--   SELECT * FROM get_business_panel_metrics(NULL, 'variant-uuid', 5)
CREATE OR REPLACE FUNCTION get_business_panel_metrics(
  p_product_id uuid DEFAULT NULL,
  p_variant_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1
)
RETURNS TABLE(
  product_id uuid,
  variant_id uuid,
  item_name text,
  sku text,
  item_type text,
  cost_per_unit numeric,
  suggested_pvp_per_unit numeric,
  quantity integer,
  total_investment numeric,
  total_revenue numeric,
  total_profit numeric,
  profit_percentage numeric,
  profit_per_unit numeric
) AS $$
DECLARE
  v_cost numeric;
  v_suggested_pvp numeric;
  v_item_name text;
  v_sku text;
  v_item_type text;
  v_total_investment numeric;
  v_total_revenue numeric;
  v_total_profit numeric;
  v_margin numeric;
  v_profit_unit numeric;
BEGIN
  -- Guard against invalid inputs
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  -- Get data based on whether product_id or variant_id is provided
  IF p_product_id IS NOT NULL THEN
    -- Product path
    SELECT cost_per_unit, suggested_pvp_per_unit, item_name, sku, item_type
    INTO v_cost, v_suggested_pvp, v_item_name, v_sku, v_item_type
    FROM v_business_panel_data
    WHERE product_id = p_product_id AND variant_id IS NULL
    LIMIT 1;
    
  ELSIF p_variant_id IS NOT NULL THEN
    -- Variant path
    SELECT cost_per_unit, suggested_pvp_per_unit, item_name, sku, item_type
    INTO v_cost, v_suggested_pvp, v_item_name, v_sku, v_item_type
    FROM v_business_panel_data
    WHERE variant_id = p_variant_id
    LIMIT 1;
  ELSE
    RETURN; -- Neither product nor variant specified
  END IF;

  IF v_cost IS NULL THEN
    RETURN; -- Item not found
  END IF;

  -- Calculate metrics for the given quantity
  v_total_investment := v_cost * p_quantity;
  v_total_revenue := v_suggested_pvp * p_quantity;
  v_total_profit := v_total_revenue - v_total_investment;
  v_margin := CASE 
    WHEN v_total_investment > 0 THEN (v_total_profit / v_total_investment * 100)
    ELSE 0
  END;
  v_profit_unit := v_suggested_pvp - v_cost;

  RETURN QUERY SELECT
    CASE WHEN p_product_id IS NOT NULL THEN p_product_id ELSE (SELECT product_id FROM v_business_panel_data WHERE variant_id = p_variant_id LIMIT 1) END::uuid,
    p_variant_id,
    v_item_name,
    v_sku,
    v_item_type,
    v_cost::numeric,
    v_suggested_pvp::numeric,
    p_quantity,
    v_total_investment::numeric,
    v_total_revenue::numeric,
    v_total_profit::numeric,
    v_margin::numeric(10,1),
    v_profit_unit::numeric;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate BusinessPanel metrics from investment and quantity (generic)
-- Usage: SELECT * FROM calculate_business_panel_from_cost(100.00, 10)
CREATE OR REPLACE FUNCTION calculate_business_panel_from_cost(
  p_cost_per_unit numeric,
  p_quantity integer DEFAULT 1
)
RETURNS TABLE(
  cost_per_unit numeric,
  suggested_pvp_per_unit numeric,
  quantity integer,
  total_investment numeric,
  total_revenue numeric,
  total_profit numeric,
  profit_percentage numeric,
  profit_per_unit numeric
) AS $$
DECLARE
  v_suggested_pvp numeric;
  v_total_investment numeric;
  v_total_revenue numeric;
  v_total_profit numeric;
  v_margin numeric;
  v_profit_unit numeric;
BEGIN
  -- Guard against invalid inputs
  IF p_cost_per_unit < 0 OR p_quantity <= 0 THEN
    RETURN;
  END IF;

  -- Calculate metrics
  v_suggested_pvp := p_cost_per_unit * 2.5;
  v_total_investment := p_cost_per_unit * p_quantity;
  v_total_revenue := v_suggested_pvp * p_quantity;
  v_total_profit := v_total_revenue - v_total_investment;
  v_margin := CASE 
    WHEN v_total_investment > 0 THEN (v_total_profit / v_total_investment * 100)
    ELSE 0
  END;
  v_profit_unit := v_suggested_pvp - p_cost_per_unit;

  RETURN QUERY SELECT
    p_cost_per_unit::numeric,
    v_suggested_pvp::numeric,
    p_quantity,
    v_total_investment::numeric,
    v_total_revenue::numeric,
    v_total_profit::numeric,
    v_margin::numeric(10,1),
    v_profit_unit::numeric;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON VIEW v_business_panel_data IS 'Unified view for BusinessPanel data combining products and variants with all metrics for 1 unit. Use with functions for multiplied quantities.';
COMMENT ON FUNCTION get_business_panel_metrics(uuid, uuid, integer) IS 'Get complete BusinessPanel metrics for a specific product or variant multiplied by quantity. Important: provide either p_product_id OR p_variant_id, not both.';
COMMENT ON FUNCTION calculate_business_panel_from_cost(numeric, integer) IS 'Calculate BusinessPanel metrics from cost per unit and quantity. Generic function not tied to specific items.';
