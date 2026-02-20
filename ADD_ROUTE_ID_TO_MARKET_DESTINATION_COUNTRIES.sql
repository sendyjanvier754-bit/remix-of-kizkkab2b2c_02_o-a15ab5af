-- =============================================================================
-- MIGRACIÓN: Agregar route_id a market_destination_countries
-- =============================================================================
-- REGLA: Cada país en un mercado DEBE tener una ruta asignada.
--        La ruta debe tener destination_country_id == destination_country_id
--        del mismo registro en market_destination_countries.
-- =============================================================================

-- ── PASO 1: Agregar columna route_id ─────────────────────────────────────────
ALTER TABLE public.market_destination_countries
  ADD COLUMN IF NOT EXISTS route_id UUID
    REFERENCES public.shipping_routes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.market_destination_countries.route_id IS
  'Ruta logística asignada a este país dentro del mercado. '
  'route.destination_country_id debe coincidir con destination_country_id de este registro.';

-- ── PASO 2: Migrar datos existentes ──────────────────────────────────────────
-- El país primario hereda markets.shipping_route_id
UPDATE public.market_destination_countries mdc
SET route_id = m.shipping_route_id
FROM public.markets m
WHERE mdc.market_id    = m.id
  AND mdc.is_primary   = TRUE
  AND m.shipping_route_id IS NOT NULL
  AND mdc.route_id IS NULL;

-- ── PASO 3: Agregar constraint de integridad (opcional, recomendado) ──────────
-- Verifica que la ruta asignada tenga el mismo país destino.
-- Usamos un CHECK con subquery para compatibilidad con Supabase/Postgres 15+.
-- NOTA: Si quieres aplicarlo, ejecuta la siguiente función trigger en su lugar:

CREATE OR REPLACE FUNCTION public.check_mdc_route_country_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.route_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.shipping_routes
      WHERE id = NEW.route_id
        AND destination_country_id = NEW.destination_country_id
    ) THEN
      RAISE EXCEPTION
        'La ruta seleccionada (id=%) no corresponde al país destino (id=%) de este mercado.',
        NEW.route_id, NEW.destination_country_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mdc_route_country_match ON public.market_destination_countries;
CREATE TRIGGER trg_mdc_route_country_match
  BEFORE INSERT OR UPDATE OF route_id, destination_country_id
  ON public.market_destination_countries
  FOR EACH ROW EXECUTE FUNCTION public.check_mdc_route_country_match();

-- ── PASO 4: Reconstruir markets_dashboard incluyendo route_id por país ────────
DROP VIEW IF EXISTS public.markets_dashboard CASCADE;

CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT
  m.id,
  m.name,
  m.code,
  m.description,
  -- Backward compat: primary country fields
  pc.id                     AS destination_country_id,
  pc.name                   AS destination_country_name,
  pc.code                   AS destination_country_code,
  m.shipping_route_id,
  m.currency,
  m.is_active,
  m.timezone,
  m.sort_order,
  m.metadata,
  m.created_at,
  m.updated_at,
  sr.id                     AS route_id,
  th.name                   AS transit_hub_name,
  th.code                   AS transit_hub_code,
  -- Array de todos los países del mercado (ahora incluye route_id)
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id',         dc2.id,
          'name',       dc2.name,
          'code',       dc2.code,
          'is_primary', mdc2.is_primary,
          'route_id',   mdc2.route_id
        ) ORDER BY mdc2.is_primary DESC, mdc2.sort_order, dc2.name
      )
      FROM public.market_destination_countries mdc2
      JOIN public.destination_countries dc2 ON mdc2.destination_country_id = dc2.id
      WHERE mdc2.market_id = m.id AND mdc2.is_active = TRUE
    ),
    '[]'::json
  ) AS countries,
  COALESCE((
    SELECT COUNT(*)
    FROM public.market_destination_countries
    WHERE market_id = m.id AND is_active = TRUE
  ), 0) AS country_count,
  COALESCE((
    SELECT COUNT(*)
    FROM public.shipping_tiers st
    JOIN public.shipping_routes sr2 ON st.route_id = sr2.id
    JOIN public.market_destination_countries mdc3 ON sr2.destination_country_id = mdc3.destination_country_id
    WHERE mdc3.market_id = m.id
      AND mdc3.is_active = TRUE
      AND sr2.is_active  = TRUE
      AND st.is_active   = TRUE
  ), 0) AS tier_count,
  COALESCE((
    SELECT COUNT(*)
    FROM public.shipping_routes sr3
    JOIN public.market_destination_countries mdc4 ON sr3.destination_country_id = mdc4.destination_country_id
    WHERE mdc4.market_id = m.id
      AND mdc4.is_active  = TRUE
      AND sr3.is_active   = TRUE
  ), 0) AS route_count,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.market_destination_countries mdc5
      JOIN public.shipping_routes sr4  ON sr4.destination_country_id  = mdc5.destination_country_id
      JOIN public.shipping_tiers   st2 ON st2.route_id                = sr4.id
      WHERE mdc5.market_id    = m.id
        AND mdc5.is_active    = TRUE
        AND sr4.is_active     = TRUE
        AND st2.is_active     = TRUE
    ) THEN TRUE
    ELSE FALSE
  END AS is_ready,
  COALESCE((
    SELECT COUNT(*) FROM public.product_markets pm
    WHERE pm.market_id = m.id AND pm.is_active
  ), 0) AS product_count,
  COALESCE((
    SELECT COUNT(*) FROM public.market_payment_methods mpm
    WHERE mpm.market_id = m.id AND mpm.is_active
  ), 0) AS payment_method_count,
  COALESCE((
    SELECT COUNT(*) FROM public.seller_markets sm
    WHERE sm.market_id = m.id
  ), 0) AS seller_count
FROM public.markets m
LEFT JOIN public.market_destination_countries mdc_p ON mdc_p.market_id = m.id AND mdc_p.is_primary = TRUE AND mdc_p.is_active = TRUE
LEFT JOIN public.destination_countries pc            ON pc.id = mdc_p.destination_country_id
LEFT JOIN public.shipping_routes sr                  ON m.shipping_route_id = sr.id
LEFT JOIN public.transit_hubs th                     ON sr.transit_hub_id   = th.id;

GRANT SELECT ON public.markets_dashboard TO authenticated;
GRANT SELECT ON public.markets_dashboard TO anon;

-- ── PASO 5: Verificar ─────────────────────────────────────────────────────────
SELECT
  m.name         AS mercado,
  dc.name        AS pais,
  mdc.is_primary,
  sr.route_name  AS ruta_asignada,
  sr.destination_country_id = mdc.destination_country_id AS ruta_coincide
FROM public.market_destination_countries mdc
JOIN public.markets m ON m.id = mdc.market_id
JOIN public.destination_countries dc ON dc.id = mdc.destination_country_id
LEFT JOIN public.shipping_routes sr ON sr.id = mdc.route_id
ORDER BY m.name, mdc.is_primary DESC;
