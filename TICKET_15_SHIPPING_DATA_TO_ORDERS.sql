-- ============================================================
-- TICKET #15: Guardar shipping_tier_id + costos de envío en orders_b2b
-- Fecha: 22-Feb-2026
-- Tabla: orders_b2b (nombre real confirmado)
-- ============================================================

-- PASO 1: Agregar columnas de logística a orders_b2b
-- shipping_tier_id  → FK al tier de envío seleccionado (Express/Standard/Economy)
-- shipping_cost_global_usd → snapshot inmutable del costo de logística global (China → Hub)
-- shipping_cost_local_usd  → snapshot inmutable del costo de logística local (Hub → Commune)
-- shipping_cost_total_usd  → global + local (calculado al confirmar, no post-order)
-- local_commune_id    → commune elegida por el buyer para entrega
-- local_pickup_point_id → pwen de livrezon opcional (NULL si es entrega a domicilio)

ALTER TABLE public.orders_b2b
  ADD COLUMN IF NOT EXISTS shipping_tier_id        UUID
    REFERENCES public.shipping_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_cost_global_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS shipping_cost_local_usd  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS shipping_cost_total_usd  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS local_commune_id         UUID
    REFERENCES public.communes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_pickup_point_id    UUID
    REFERENCES public.pickup_points(id) ON DELETE SET NULL;

-- PASO 2: Comentarios descriptivos
COMMENT ON COLUMN public.orders_b2b.shipping_tier_id IS
  'FK al tier de envío (shipping_tiers) seleccionado al confirmar la orden. NULL si no se seleccionó o eliminado.';

COMMENT ON COLUMN public.orders_b2b.shipping_cost_global_usd IS
  'Snapshot del costo de logística global (China → Hub Maestro) al momento de confirmar la orden. Inmutable.';

COMMENT ON COLUMN public.orders_b2b.shipping_cost_local_usd IS
  'Snapshot del costo de logística local (Hub → Commune/Domicilio) al momento de confirmar. Inmutable.';

COMMENT ON COLUMN public.orders_b2b.shipping_cost_total_usd IS
  'Costo total de envío = shipping_cost_global_usd + shipping_cost_local_usd. Snapshot inmutable.';

COMMENT ON COLUMN public.orders_b2b.local_commune_id IS
  'Commune de entrega elegida por el buyer. Referencia a communes(id). NULL si es pickup point sin commune.';

COMMENT ON COLUMN public.orders_b2b.local_pickup_point_id IS
  'Pwen de livrezon (pickup point) elegido por el buyer. NULL si entrega a domicilio.';

-- PASO 3: Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_orders_b2b_shipping_tier_id
  ON public.orders_b2b(shipping_tier_id)
  WHERE shipping_tier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_b2b_local_commune_id
  ON public.orders_b2b(local_commune_id)
  WHERE local_commune_id IS NOT NULL;

-- PASO 4: Validación — ver columnas después de la migración
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'orders_b2b'
  AND column_name IN (
    'shipping_tier_id',
    'shipping_cost_global_usd',
    'shipping_cost_local_usd',
    'shipping_cost_total_usd',
    'local_commune_id',
    'local_pickup_point_id'
  )
ORDER BY column_name;
