-- =============================================================================
-- MIGRACIÓN: Un mercado puede tener MÚLTIPLES países destino
-- =============================================================================
-- CONTEXTO: markets.destination_country_id era 1:1 (un país por mercado).
-- NUEVO MODELO: market_destination_countries (N:N — un mercado, varios países)
--
-- JERARQUÍA:
--   markets (1) → market_destination_countries (N) → destination_countries
--   Cada país de un mercado tiene sus propias rutas y tiers.
--   El seller elige: mercado → país específico → stores los dos IDs.
-- =============================================================================

-- ── PASO 1: Crear tabla junction ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_destination_countries (
  id                     UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id              UUID          NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  destination_country_id UUID          NOT NULL REFERENCES public.destination_countries(id),
  is_primary             BOOLEAN       NOT NULL DEFAULT false,
  is_active              BOOLEAN       NOT NULL DEFAULT true,
  sort_order             INTEGER       NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(market_id, destination_country_id)
);

CREATE INDEX IF NOT EXISTS idx_mdc_market   ON public.market_destination_countries(market_id);
CREATE INDEX IF NOT EXISTS idx_mdc_country  ON public.market_destination_countries(destination_country_id);
CREATE INDEX IF NOT EXISTS idx_mdc_active   ON public.market_destination_countries(is_active);

-- RLS
ALTER TABLE public.market_destination_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mdc_select_all"  ON public.market_destination_countries FOR SELECT USING (true);
CREATE POLICY "mdc_manage_admin" ON public.market_destination_countries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

GRANT SELECT ON public.market_destination_countries TO authenticated;
GRANT SELECT ON public.market_destination_countries TO anon;

-- ── PASO 2: Migrar datos existentes ──────────────────────────────────────────
-- Copiar el destination_country_id actual de cada mercado como país primario
INSERT INTO public.market_destination_countries (market_id, destination_country_id, is_primary, is_active)
SELECT id, destination_country_id, true, true
FROM public.markets
WHERE destination_country_id IS NOT NULL
ON CONFLICT (market_id, destination_country_id) DO NOTHING;

-- Verificar migración
SELECT
  m.name        AS mercado,
  m.code,
  dc.name       AS pais_actual,
  mdc.is_primary,
  mdc.is_active
FROM public.markets m
LEFT JOIN public.market_destination_countries mdc ON m.id = mdc.market_id
LEFT JOIN public.destination_countries dc ON mdc.destination_country_id = dc.id
ORDER BY m.name, mdc.is_primary DESC;

-- ── PASO 3: Agregar destination_country_id a stores ──────────────────────────
-- NOTA IMPORTANTE:
--   stores.destination_country_id = PAÍS DONDE EL SELLER ENTREGA a sus clientes
--   NO es el país donde el seller está ubicado, NI el origen del producto.
--   Ejemplo: Seller vende productos desde China/USA, pero sus clientes
--            están en Haití → destination_country_id = id del país Haití.
--   Este valor se usa en get_product_shipping_cost_by_country() para calcular
--   los costos de envío que se muestran en la columna "Logística" del catálogo.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS destination_country_id UUID
    REFERENCES public.destination_countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_destination_country ON public.stores(destination_country_id);

-- ── PASO 4: Reconstruir markets_dashboard con el nuevo modelo ─────────────────
DROP VIEW IF EXISTS public.markets_dashboard CASCADE;

CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT
  m.id,
  m.name,
  m.code,
  m.description,
  -- Backward compat: primary country fields (primera entrada is_primary=true)
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
  -- Ruta primaria (de la ruta directa del mercado)
  sr.id                     AS route_id,
  th.name                   AS transit_hub_name,
  th.code                   AS transit_hub_code,
  -- ── NUEVO: array de TODOS los países del mercado ──────────────────────
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id',         dc2.id,
          'name',       dc2.name,
          'code',       dc2.code,
          'is_primary', mdc2.is_primary
        ) ORDER BY mdc2.is_primary DESC, mdc2.sort_order, dc2.name
      )
      FROM public.market_destination_countries mdc2
      JOIN public.destination_countries dc2 ON mdc2.destination_country_id = dc2.id
      WHERE mdc2.market_id = m.id AND mdc2.is_active = TRUE
    ),
    '[]'::json
  ) AS countries,
  -- Cuántos países tiene este mercado
  COALESCE((
    SELECT COUNT(*)
    FROM public.market_destination_countries
    WHERE market_id = m.id AND is_active = TRUE
  ), 0) AS country_count,
  -- Tiers activos en TODOS los países del mercado
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
  -- Rutas activas en TODOS los países del mercado
  COALESCE((
    SELECT COUNT(*)
    FROM public.shipping_routes sr3
    JOIN public.market_destination_countries mdc4 ON sr3.destination_country_id = mdc4.destination_country_id
    WHERE mdc4.market_id = m.id
      AND mdc4.is_active  = TRUE
      AND sr3.is_active   = TRUE
  ), 0) AS route_count,
  -- is_ready: tiene al menos 1 país activo con ruta + tier activos
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
  -- Conteos existentes (sin cambios)
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
-- Primary country (is_primary = true)
LEFT JOIN public.market_destination_countries mdc_p ON mdc_p.market_id = m.id AND mdc_p.is_primary = TRUE AND mdc_p.is_active = TRUE
LEFT JOIN public.destination_countries pc            ON pc.id = mdc_p.destination_country_id
LEFT JOIN public.shipping_routes sr                  ON m.shipping_route_id = sr.id
LEFT JOIN public.transit_hubs th                     ON sr.transit_hub_id   = th.id;

COMMENT ON VIEW public.markets_dashboard IS
  'Mercados con múltiples países. countries=[{id,name,code,is_primary}]. is_ready cuando tiene ≥1 país con ruta+tier activos.';

GRANT SELECT ON public.markets_dashboard TO authenticated;
GRANT SELECT ON public.markets_dashboard TO anon;

-- ── PASO 5: Verificar resultado ───────────────────────────────────────────────
SELECT
  name,
  code,
  is_active,
  country_count,
  tier_count,
  route_count,
  is_ready,
  countries::text AS paises_json
FROM public.markets_dashboard
ORDER BY sort_order, name;

-- ── PASO 6 (Ejemplo): Agregar segundo país a un mercado ──────────────────────
-- INSERT INTO public.market_destination_countries (market_id, destination_country_id, is_primary)
-- VALUES (
--   (SELECT id FROM public.markets WHERE code = 'CARIBE'),
--   (SELECT id FROM public.destination_countries WHERE code = 'DO'),  -- Dominican Republic
--   false
-- );
