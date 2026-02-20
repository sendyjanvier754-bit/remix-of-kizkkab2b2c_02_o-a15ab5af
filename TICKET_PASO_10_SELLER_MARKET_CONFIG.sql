-- =============================================================================
-- TICKET #10: SELLER MARKET CONFIGURATION
-- =============================================================================
-- OBJETIVO: Que el seller seleccione su mercado desde Mi Cuenta.
--
-- REGLA DE NEGOCIO:
--   - Solo el ADMIN crea/modifica markets, paises, rutas y tipos de envio
--   - El seller SOLO elige de la lista de mercados LISTOS (is_ready = true)
--   - Un mercado esta LISTO cuando:
--       markets.destination_country_id IS NOT NULL        (paso 1)
--       + al menos 1 shipping_route activa para ese pais  (paso 2)
--       + al menos 1 shipping_tier activo en esa ruta     (paso 3)
--   - Cada tier pertenece a UNA SOLA ruta, cada ruta a UN SOLO pais
--     (ya garantizado por FK: tiers.route_id -> routes.destination_country_id)
-- =============================================================================

-- ── PASO 1: market_id en stores ─────────────────────────────────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_market_id ON public.stores(market_id);

-- ── PASO 2: Asegurar que markets.destination_country_id no sea NULL ──────────
-- (Si ya tiene datos NULL, primero limpiarlos o asignarlos antes de correr esto)
-- ALTER TABLE public.markets
--   ALTER COLUMN destination_country_id SET NOT NULL;

-- ── PASO 3: Reemplazar markets_dashboard para incluir tier_count e is_ready ──
DROP VIEW IF EXISTS public.markets_dashboard CASCADE;

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
  dc.name  AS destination_country_name,
  dc.code  AS destination_country_code,
  sr.id    AS route_id,
  th.name  AS transit_hub_name,
  th.code  AS transit_hub_code,
  -- Cuantos tiers activos tiene el pais de este mercado
  COALESCE((
    SELECT COUNT(*)
    FROM public.shipping_tiers st
    JOIN public.shipping_routes sr2 ON st.route_id = sr2.id
    WHERE sr2.destination_country_id = m.destination_country_id
      AND sr2.is_active = TRUE
      AND st.is_active = TRUE
  ), 0) AS tier_count,
  -- Cuantas rutas activas tiene el pais de este mercado
  COALESCE((
    SELECT COUNT(*)
    FROM public.shipping_routes sr3
    WHERE sr3.destination_country_id = m.destination_country_id
      AND sr3.is_active = TRUE
  ), 0) AS route_count,
  -- is_ready: mercado completamente configurado (pais + ruta + tier)
  CASE
    WHEN m.destination_country_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.shipping_tiers st
       JOIN public.shipping_routes sr4 ON st.route_id = sr4.id
       WHERE sr4.destination_country_id = m.destination_country_id
         AND sr4.is_active = TRUE AND st.is_active = TRUE
     )
    THEN TRUE
    ELSE FALSE
  END AS is_ready,
  -- Conteos existentes
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
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
LEFT JOIN public.shipping_routes sr       ON m.shipping_route_id = sr.id
LEFT JOIN public.transit_hubs th          ON sr.transit_hub_id = th.id;

COMMENT ON VIEW public.markets_dashboard IS
  'Mercados con estado de completitud. is_ready=true cuando tiene pais+ruta+tier activos.';

GRANT SELECT ON public.markets_dashboard TO authenticated;
GRANT SELECT ON public.markets_dashboard TO anon;

-- ── PASO 4: Verificar estado actual de mercados ──────────────────────────────
SELECT
  name,
  code,
  is_active,
  destination_country_name,
  route_count,
  tier_count,
  is_ready,
  CASE
    WHEN destination_country_id IS NULL THEN 'SIN PAIS'
    WHEN route_count = 0              THEN 'SIN RUTA'
    WHEN tier_count = 0               THEN 'SIN TIERS'
    ELSE 'LISTO'
  END AS estado
FROM public.markets_dashboard
ORDER BY sort_order, name;

-- ── PASO 5 (Opcional): Pre-asignar mercado a una tienda existente ────────────
-- UPDATE public.stores
-- SET market_id = (SELECT id FROM public.markets WHERE code = 'HT' AND is_active = TRUE LIMIT 1)
-- WHERE owner_user_id = '<seller_user_uuid>';

-- =============================================================================
-- CONSTRAINT DE NEGOCIO (tier -> 1 pais):
--   Ya garantizado por diseño de tablas:
--   shipping_tiers.route_id -> shipping_routes.id
--   shipping_routes.destination_country_id -> destination_countries.id
--   => Un tier SIEMPRE pertenece a exactamente 1 pais via su ruta.
--
-- FLUJO DE CONFIGURACION (Admin primero, luego Seller):
--   [Admin] 1. Crear pais destino en Logistica > Paises
--   [Admin] 2. Crear ruta para ese pais en Logistica > Rutas
--   [Admin] 3. Crear shipping tiers para esa ruta (standard/express)
--   [Admin] 4. Crear mercado en Mercados, asignar pais + ruta
--             -> is_ready = TRUE  <- seller ya puede verlo
--   [Seller] 5. Ir a Mi Cuenta > Informacion > Mercado de Envio
--             -> seleccionar mercado -> guardar
--   [Sistema] 6. useSellerCatalog lee stores.market_id -> destination_country_id
--             -> columna Logistica muestra $8.04 / $16.08
-- =============================================================================
--
-- RELACION:
--   stores.market_id -> markets.destination_country_id
--                                     |
--         get_product_shipping_cost_by_country(product_id, destination_country_id)
--
-- POR QUE stores (no addresses):
--   - Seller tiene exactamente 1 tienda (1:1), addresses puede tener varias
--   - addresses tiene campos requeridos (city, full_name, etc.) que no aplican
--   - stores ya esta cargado en el frontend con useStoreByOwner()
-- =============================================================================

-- PASO 1: Agregar market_id a la tabla stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_market_id ON public.stores(market_id);

-- PASO 2: Ver que sellers tienen mercado configurado
SELECT
  s.id         AS store_id,
  s.name       AS store_name,
  s.owner_user_id,
  p.full_name  AS seller_nombre,
  m.name       AS mercado_configurado,
  m.code       AS mercado_code,
  dc.name      AS pais_destino,
  s.market_id,
  s.updated_at
FROM public.stores s
LEFT JOIN public.profiles p  ON s.owner_user_id = p.id
LEFT JOIN public.markets m   ON s.market_id = m.id
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
ORDER BY s.updated_at DESC;

-- PASO 3: Ver mercados activos disponibles para el selector del seller
-- (Solo los que el admin creo y activo)
SELECT
  m.id,
  m.name,
  m.code,
  m.currency,
  dc.name AS pais_destino,
  dc.code AS pais_code,
  (
    SELECT COUNT(*) FROM public.shipping_tiers st
    JOIN public.shipping_routes sr ON st.route_id = sr.id
    WHERE sr.destination_country_id = m.destination_country_id
      AND sr.is_active = TRUE AND st.is_active = TRUE
  ) AS tiers_disponibles
FROM public.markets m
JOIN public.destination_countries dc ON m.destination_country_id = dc.id
WHERE m.is_active = TRUE
ORDER BY m.sort_order, m.name;

-- PASO 4 (Opcional): Pre-configurar tienda existente manualmente
-- UPDATE public.stores
-- SET market_id = (SELECT id FROM public.markets WHERE code = 'HT' LIMIT 1)
-- WHERE owner_user_id = '<seller_user_uuid>';

-- =============================================================================
-- FLUJO COMPLETO POST-MIGRACION:
--   1. Admin crea mercado en /admin/markets (nombre, pais, ruta, tiers)
--   2. Seller entra a Mi Cuenta -> elige mercado -> guarda
--      -> stores.market_id = <market_id>
--   3. useSellerCatalog: stores.market_id -> markets.destination_country_id
--   4. get_product_shipping_cost_by_country calcula el costo de envio
--   5. Columna "Logistica" muestra $8.04 / $16.08 en el catalogo
-- =============================================================================
