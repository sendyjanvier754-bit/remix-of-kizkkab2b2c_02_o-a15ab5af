-- =============================================================================
-- FIX: markets_dashboard — route info now from shipping_routes.market_id
-- =============================================================================
-- PROBLEMA: La vista leía shipping_route_id de markets (siempre NULL).
--           route_count no existía → todas las filas mostraban "Sin Ruta".
-- SOLUCIÓN: Calcular route_count, shipping_route_id, transit_hub_name
--           desde shipping_routes WHERE market_id = m.id
-- =============================================================================

DROP VIEW IF EXISTS public.markets_dashboard CASCADE;

CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT
  m.id,
  m.name,
  m.code,
  m.description,
  m.destination_country_id,
  m.currency,
  m.is_active,
  m.timezone,
  m.sort_order,
  m.metadata,
  m.created_at,
  m.updated_at,

  -- Primary destination country info
  dc.name AS destination_country_name,
  dc.code AS destination_country_code,

  -- ----------------------------------------------------------------
  -- Route info: derived from shipping_routes.market_id (new model)
  -- ----------------------------------------------------------------

  -- ID of the first active route assigned to this market
  (
    SELECT sr.id
    FROM public.shipping_routes sr
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
    ORDER BY sr.created_at
    LIMIT 1
  ) AS shipping_route_id,

  -- Same value aliased as route_id for UI compatibility
  (
    SELECT sr.id
    FROM public.shipping_routes sr
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
    ORDER BY sr.created_at
    LIMIT 1
  ) AS route_id,

  -- Transit hub name from first route's hub (NULL = Directo)
  (
    SELECT th.name
    FROM public.shipping_routes sr
    LEFT JOIN public.transit_hubs th ON th.id = sr.transit_hub_id
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
    ORDER BY sr.created_at
    LIMIT 1
  ) AS transit_hub_name,

  -- Transit hub code from first route's hub
  (
    SELECT th.code
    FROM public.shipping_routes sr
    LEFT JOIN public.transit_hubs th ON th.id = sr.transit_hub_id
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
    ORDER BY sr.created_at
    LIMIT 1
  ) AS transit_hub_code,

  -- JSON array of all active routes assigned to this market
  (
    SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'id',               sr.id,
        'name',             sr.route_name,
        'is_direct',        sr.is_direct,
        'transit_hub_name', th.name
      )
      ORDER BY sr.created_at
    )
    FROM public.shipping_routes sr
    LEFT JOIN public.transit_hubs th ON th.id = sr.transit_hub_id
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
  ) AS route_names,

  -- ----------------------------------------------------------------
  -- Counters
  -- ----------------------------------------------------------------

  -- Number of active routes assigned to this market
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.shipping_routes sr
    WHERE sr.market_id = m.id AND sr.is_active = TRUE
  ), 0) AS route_count,

  -- Number of active tiers across all routes of this market
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.shipping_tiers st
    JOIN public.shipping_routes sr ON st.route_id = sr.id
    WHERE sr.market_id = m.id AND sr.is_active = TRUE AND st.is_active = TRUE
  ), 0) AS tier_count,

  -- Number of active destination countries for this market
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.market_destination_countries mdc
    WHERE mdc.market_id = m.id AND mdc.is_active = TRUE
  ), 0) AS country_count,

  -- Number of products in this market
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.product_markets pm
    WHERE pm.market_id = m.id AND pm.is_active = TRUE
  ), 0) AS product_count,

  -- Number of payment methods configured
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.market_payment_methods mpm
    WHERE mpm.market_id = m.id AND mpm.is_active = TRUE
  ), 0) AS payment_method_count,

  -- Number of sellers configured for this market
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.seller_markets sm
    WHERE sm.market_id = m.id
  ), 0) AS seller_count,

  -- ----------------------------------------------------------------
  -- is_ready: ≥1 active route AND ≥1 active tier
  -- ----------------------------------------------------------------
  (
    (
      SELECT COUNT(*)
      FROM public.shipping_routes sr
      WHERE sr.market_id = m.id AND sr.is_active = TRUE
    ) > 0
    AND
    (
      SELECT COUNT(*)
      FROM public.shipping_tiers st
      JOIN public.shipping_routes sr ON st.route_id = sr.id
      WHERE sr.market_id = m.id AND sr.is_active = TRUE AND st.is_active = TRUE
    ) > 0
  ) AS is_ready,

  -- ----------------------------------------------------------------
  -- JSON array of destination countries for this market
  -- ----------------------------------------------------------------
  (
    SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'id',         dest.id,
        'name',       dest.name,
        'code',       dest.code,
        'is_primary', mdc2.is_primary
      )
      ORDER BY mdc2.sort_order
    )
    FROM public.market_destination_countries mdc2
    JOIN public.destination_countries dest ON dest.id = mdc2.destination_country_id
    WHERE mdc2.market_id = m.id AND mdc2.is_active = TRUE
  ) AS countries

FROM public.markets m
LEFT JOIN public.destination_countries dc ON dc.id = m.destination_country_id;

-- Permisos
GRANT SELECT ON public.markets_dashboard TO authenticated;
GRANT SELECT ON public.markets_dashboard TO anon;

-- Verificar resultado
SELECT
  id, name, code,
  route_count,
  shipping_route_id,
  transit_hub_name,
  tier_count,
  is_ready
FROM public.markets_dashboard;
