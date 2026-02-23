-- ============================================================
-- TICKET #22: Schema Logística Local
-- Basado en auditoría real de producción (22-Feb-2026)
--
-- Estado confirmado:
--  • transit_hubs: solo tiene CHINA_HUB y USA_HUB (orígenes)
--    → hay que ADD COLUMN hub_type/destination_country_id/lat/lng/address
--    → hay que INSERT Haiti Hub (no existe Hinche)
--  • communes: 25 registros con precios reales, tiene shipping_zone_id
--    → hay que ADD COLUMN transit_hub_id
--  • local_expedition_ids: NO EXISTE → CREATE TABLE
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PASO 1: Extender transit_hubs
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.transit_hubs
  ADD COLUMN IF NOT EXISTS hub_type VARCHAR(20) NOT NULL DEFAULT 'global'
    CHECK (hub_type IN ('global', 'local_master', 'terminal_bus')),
  ADD COLUMN IF NOT EXISTS destination_country_id UUID
    REFERENCES public.destination_countries(id),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

COMMENT ON COLUMN public.transit_hubs.hub_type IS
  'global = hub de tránsito internacional (CHINA_HUB/USA_HUB); local_master = hub maestro en destino; terminal_bus = nodo local secundario';

-- Marcar los hubs existentes como tipo global
UPDATE public.transit_hubs
SET hub_type = 'global'
WHERE code IN ('CHINA_HUB', 'USA_HUB');

-- Constraint: solo 1 hub_master activo por país destino
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_master_hub_per_country
  ON public.transit_hubs(destination_country_id)
  WHERE hub_type = 'local_master' AND is_active = true;

-- ─────────────────────────────────────────────────────────────
-- PASO 2: Insertar Hub Maestro de Haití
-- (no existe en transit_hubs — solo hay CHINA_HUB y USA_HUB)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.transit_hubs (name, code, description, hub_type, destination_country_id, is_active)
VALUES (
  'Hub Maestro Haití',
  'HAITI_HUB',
  'Hub maestro de distribución local en Haití (Hinche)',
  'local_master',
  (SELECT id FROM public.destination_countries WHERE code = 'HT' LIMIT 1),
  true
)
ON CONFLICT (code) DO NOTHING;

-- Verificar que se insertó
SELECT id, name, code, hub_type, destination_country_id, is_active
FROM public.transit_hubs
ORDER BY hub_type, name;

-- ─────────────────────────────────────────────────────────────
-- PASO 3: Agregar transit_hub_id a communes
-- (communes ya tiene shipping_zone_id — confirmado por auditoría)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS transit_hub_id UUID
    REFERENCES public.transit_hubs(id);

COMMENT ON COLUMN public.communes.transit_hub_id IS
  'Hub local (transit_hubs con hub_type=local_master o terminal_bus) que atiende esta commune';

-- Asignar el Hub Maestro de Haití a todas las communes activas
UPDATE public.communes
SET transit_hub_id = (
  SELECT id FROM public.transit_hubs WHERE code = 'HAITI_HUB' LIMIT 1
)
WHERE transit_hub_id IS NULL AND is_active = true;

-- Verificar asignación
SELECT
  c.name    AS commune,
  d.name    AS department,
  c.rate_per_lb,
  c.delivery_fee,
  c.operational_fee,
  th.name   AS hub_asignado,
  th.code   AS hub_code
FROM public.communes c
LEFT JOIN public.departments d  ON d.id  = c.department_id
LEFT JOIN public.transit_hubs th ON th.id = c.transit_hub_id
ORDER BY d.name, c.name;

-- ─────────────────────────────────────────────────────────────
-- PASO 4: Crear tabla local_expedition_ids
-- (NO EXISTE — confirmado por auditoría)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.local_expedition_ids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID,
  commune_id      UUID REFERENCES public.communes(id),
  transit_hub_id  UUID REFERENCES public.transit_hubs(id),
  pickup_point_id UUID REFERENCES public.pickup_points(id),
  expedition_code VARCHAR(20) NOT NULL UNIQUE,
  issued_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.local_expedition_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage local expeditions" ON public.local_expedition_ids
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- PASO 5: Verificación final
-- ─────────────────────────────────────────────────────────────
SELECT
  'transit_hubs nuevas cols' AS check,
  COUNT(*) FILTER (WHERE column_name IN ('hub_type','destination_country_id','lat','lng','address')) AS cols_agregadas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transit_hubs'
UNION ALL
SELECT
  'communes.transit_hub_id',
  COUNT(*) FILTER (WHERE column_name = 'transit_hub_id')
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'communes'
UNION ALL
SELECT
  'local_expedition_ids existe',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'local_expedition_ids'
  ) THEN 1 ELSE 0 END
UNION ALL
SELECT
  'communes con hub asignado',
  COUNT(*) FILTER (WHERE transit_hub_id IS NOT NULL)
FROM public.communes;
