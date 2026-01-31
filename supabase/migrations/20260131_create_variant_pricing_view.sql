-- ============================================
-- VARIANT PRICING OPTIMIZATION
-- Create v_variantes_con_precio_b2b view
-- Single source of truth for all variant prices
-- ============================================

-- Create view for product variants with dynamic B2B pricing
DROP VIEW IF EXISTS public.v_variantes_con_precio_b2b CASCADE;

CREATE VIEW public.v_variantes_con_precio_b2b AS
SELECT
  pv.id,
  pv.product_id,
  pv.sku,
  pv.name,
  pv.attribute_combination,
  pv.cost_price,
  pv.price,
  pv.price_adjustment,
  pv.stock,
  pv.moq,
  pv.images,
  pv.is_active,
  -- Get the cost base for the parent product
  COALESCE(pv.cost_price, p.costo_base_excel) AS costo_base_efectivo,
  -- Calculate dynamic B2B price for variant
  public.calculate_base_price_only(p.id, NULL) AS precio_b2b_base,
  -- Apply variant-specific adjustment if exists
  CASE 
    WHEN pv.price_adjustment IS NOT NULL AND pv.price_adjustment != 0 
    THEN ROUND((public.calculate_base_price_only(p.id, NULL) * (1 + pv.price_adjustment / 100.0))::numeric, 2)
    ELSE public.calculate_base_price_only(p.id, NULL)
  END AS precio_b2b_final,
  -- Include applied margin for debugging
  COALESCE(
    (SELECT margin_percent FROM public.b2b_margin_ranges 
     WHERE is_active = true 
       AND COALESCE(pv.cost_price, p.costo_base_excel) >= min_cost 
       AND (max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < max_cost)
     ORDER BY sort_order ASC
     LIMIT 1),
    30
  ) AS applied_margin_percent,
  p.sku_interno AS parent_sku,
  p.nombre AS product_name,
  pv.created_at,
  pv.updated_at
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

-- Create simplified view for quick variant lookups (with just essential fields)
DROP VIEW IF EXISTS public.v_variantes_precio_simple CASCADE;

CREATE VIEW public.v_variantes_precio_simple AS
SELECT
  pv.id,
  pv.sku,
  pv.product_id,
  pv.attribute_combination,
  pv.moq,
  CASE 
    WHEN pv.price_adjustment IS NOT NULL AND pv.price_adjustment != 0 
    THEN ROUND((public.calculate_base_price_only(p.id, NULL) * (1 + pv.price_adjustment / 100.0))::numeric, 2)
    ELSE public.calculate_base_price_only(p.id, NULL)
  END AS precio_b2b
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

-- Verification query to see variant pricing in action
SELECT 
  'Variant Pricing Verification' AS test,
  pv.sku,
  pv.name,
  pv.cost_price,
  p.costo_base_excel AS product_cost,
  vv.applied_margin_percent,
  vv.precio_b2b_base,
  vv.price_adjustment,
  vv.precio_b2b_final,
  pv.moq
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
LEFT JOIN public.v_variantes_con_precio_b2b vv ON pv.id = vv.id
WHERE pv.is_active = true AND p.is_active = true
ORDER BY pv.created_at DESC
LIMIT 15;
