-- ============================================================================
-- CREATE: Markets Dashboard View (Simplified - No dependencies on missing tables)
-- ============================================================================

-- Drop view if exists
DROP VIEW IF EXISTS public.markets_dashboard CASCADE;

-- Create the markets_dashboard view (simplified version)
CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT 
  m.id,
  m.name,
  m.code,
  m.description,
  m.destination_country_id,
  m.shipping_route_id,
  m.currency,
  m.is_active,
  m.timezone,
  m.sort_order,
  m.metadata,
  m.created_at,
  m.updated_at,
  dc.name as destination_country_name,
  dc.code as destination_country_code,
  sr.id as route_id,
  th.name as transit_hub_name,
  th.code as transit_hub_code,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.product_markets pm 
    WHERE pm.market_id = m.id AND pm.is_active
  ), 0) as product_count,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.market_payment_methods mpm 
    WHERE mpm.market_id = m.id AND mpm.is_active
  ), 0) as payment_method_count,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.seller_markets sm 
    WHERE sm.market_id = m.id
  ), 0) as seller_count
FROM public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
LEFT JOIN public.shipping_routes sr ON m.shipping_route_id = sr.id
LEFT JOIN public.transit_hubs th ON sr.transit_hub_id = th.id;

-- Add comment
COMMENT ON VIEW public.markets_dashboard IS 'Dashboard view showing markets with related country, route, and count information';

-- Grant permissions
GRANT SELECT ON public.markets_dashboard TO authenticated;
GRANT SELECT ON public.markets_dashboard TO anon;

-- Verify view was created
SELECT 'View created successfully' as status, COUNT(*) as market_count 
FROM public.markets_dashboard;
