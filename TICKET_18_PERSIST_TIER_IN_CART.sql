-- ============================================================
-- TICKET #18: Persistencia del Tier de Envío Seleccionado en Carrito
-- Fecha: 23-Feb-2026
-- Tabla: b2b_carts
-- Objetivo: Cuando el seller recarga la página del carrito, el tier
--           de envío que eligió se restaura automáticamente (no se pierde).
-- ============================================================

-- PASO 1: Agregar columna selected_shipping_tier_id a b2b_carts
ALTER TABLE public.b2b_carts
  ADD COLUMN IF NOT EXISTS selected_shipping_tier_id UUID
    REFERENCES public.shipping_tiers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.b2b_carts.selected_shipping_tier_id IS
  'Último tier de envío seleccionado por el buyer en el carrito. Persiste entre sesiones. NULL = no seleccionado.';

-- PASO 2: Índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_b2b_carts_selected_tier
  ON public.b2b_carts(selected_shipping_tier_id)
  WHERE selected_shipping_tier_id IS NOT NULL;

-- PASO 3: Validación de la migración
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'b2b_carts'
  AND column_name  = 'selected_shipping_tier_id';

-- RESULTADO ESPERADO:
-- column_name                | data_type | is_nullable | column_default
-- selected_shipping_tier_id  | uuid      | YES         | null
