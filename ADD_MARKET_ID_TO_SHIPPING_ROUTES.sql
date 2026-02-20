-- ============================================================
-- MIGRACIÓN: Agregar market_id a shipping_routes
-- Una ruta pertenece a exactamente 1 mercado + 1 país destino
-- Múltiples rutas pueden existir por país dentro de un mercado
-- ============================================================

-- ============================================================
-- PASO 1: Agregar columna market_id a shipping_routes
-- ============================================================
ALTER TABLE public.shipping_routes
  ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL;

-- ============================================================
-- PASO 2: Migrar datos existentes
-- Las rutas ya asignadas via market_destination_countries.route_id
-- se mapean al market_id correspondiente
-- ============================================================
UPDATE public.shipping_routes sr
SET market_id = mdc.market_id
FROM public.market_destination_countries mdc
WHERE mdc.route_id = sr.id
  AND sr.market_id IS NULL;

-- ============================================================
-- PASO 3: Eliminar route_id de market_destination_countries
-- Ya no es necesario porque shipping_routes.market_id define
-- la pertenencia de la ruta al mercado+país
-- ============================================================
ALTER TABLE public.market_destination_countries 
  DROP COLUMN IF EXISTS route_id;

-- ============================================================
-- PASO 4: Eliminar el trigger de validación de country match
-- (ya no opera sobre route_id en junction table)
-- ============================================================
DROP TRIGGER IF EXISTS trg_mdc_route_country_match ON public.market_destination_countries;
DROP FUNCTION IF EXISTS public.fn_mdc_route_country_match();

-- ============================================================
-- PASO 5: Reconstruir markets_dashboard SIN route_id en countries
-- ============================================================
DROP VIEW IF EXISTS public.markets_dashboard;

CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT
  m.id,
  m.name,
  m.code,
  m.description,
  m.destination_country_id,
  m.shipping_route_id,
  m.currency,
  m.timezone,
  m.sort_order,
  m.is_active,
  m.metadata,
  m.created_at,
  m.updated_at,

  -- Primary destination country info
  dc.name AS destination_country_name,
  dc.code AS destination_country_code,
  dc.currency AS destination_country_currency,

  -- Primary shipping route info
  sr.route_name,
  sr.is_direct AS route_is_direct,
  sr.origin_country AS route_origin,
  sr.destination_country AS route_destination,

  -- Count of payment methods
  (
    SELECT COUNT(*)
    FROM public.market_payment_methods mpm
    WHERE mpm.market_id = m.id AND mpm.is_active = TRUE
  ) AS payment_method_count,

  -- Count of active shipping tiers
  (
    SELECT COUNT(*)
    FROM public.shipping_tiers st
    WHERE st.route_id IN (
      SELECT id FROM public.shipping_routes
      WHERE destination_country_id = m.destination_country_id AND is_active = TRUE
    )
    AND st.is_active = TRUE
  ) AS shipping_tier_count,

  -- JSON array of all destination countries for this market (without route_id)
  (
    SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', dest.id,
        'name', dest.name,
        'code', dest.code,
        'is_primary', mdc2.is_primary
      )
      ORDER BY mdc2.sort_order
    )
    FROM public.market_destination_countries mdc2
    JOIN public.destination_countries dest ON dest.id = mdc2.destination_country_id
    WHERE mdc2.market_id = m.id AND mdc2.is_active = TRUE
  ) AS countries

FROM public.markets m
LEFT JOIN public.destination_countries dc ON dc.id = m.destination_country_id
LEFT JOIN public.shipping_routes sr ON sr.id = m.shipping_route_id;

-- ============================================================
-- PASO 6: Verificar resultado
-- ============================================================
SELECT
  sr.route_name,
  sr.destination_country,
  sr.market_id,
  m.name AS market_name,
  dc.name AS dest_country
FROM public.shipping_routes sr
LEFT JOIN public.markets m ON m.id = sr.market_id
LEFT JOIN public.destination_countries dc ON dc.id = sr.destination_country_id
ORDER BY sr.created_at;
