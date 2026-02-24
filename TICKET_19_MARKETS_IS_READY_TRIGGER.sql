-- ============================================================
-- TICKET #19: Lógica Automática de markets.is_ready
-- Fecha: 23-Feb-2026
-- Objetivo: markets.is_ready = true cuando el mercado tiene
--           al menos 1 ruta activa con al menos 1 tier activo.
--           Se recalcula automáticamente vía triggers.
-- ============================================================

-- ============================================================
-- PASO 1: Añadir columna is_ready a markets (si no existe)
-- ============================================================
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- PASO 3: Función que recalcula is_ready para un mercado específico
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_market_is_ready(p_market_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_ready BOOLEAN;
BEGIN
  -- Un mercado está listo cuando tiene al menos 1 ruta activa
  -- con al menos 1 tier activo
  SELECT EXISTS (
    SELECT 1
    FROM public.shipping_routes sr
    JOIN public.shipping_tiers st ON st.route_id = sr.id AND st.is_active = true
    WHERE sr.market_id = p_market_id
      AND sr.is_active = true
  ) INTO v_is_ready;

  UPDATE public.markets
  SET is_ready = v_is_ready
  WHERE id = p_market_id;

  RAISE NOTICE 'market % → is_ready = %', p_market_id, v_is_ready;
END;
$$;

COMMENT ON FUNCTION public.refresh_market_is_ready IS
  'Recalcula markets.is_ready según si el mercado tiene rutas activas con tiers activos. Se llama desde triggers.';

-- ============================================================
-- PASO 4: Función trigger — detecta el market_id afectado
-- ============================================================

-- 2A: Trigger en shipping_routes (tiene market_id directamente)
CREATE OR REPLACE FUNCTION public.trg_refresh_market_ready_from_route()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_market_id UUID;
BEGIN
  -- Obtener market_id de la fila afectada (NEW para INSERT/UPDATE, OLD para DELETE)
  IF TG_OP = 'DELETE' THEN
    v_market_id := OLD.market_id;
  ELSE
    v_market_id := NEW.market_id;
    -- Si también cambió market_id en UPDATE, refrescar el anterior también
    IF TG_OP = 'UPDATE' AND OLD.market_id IS DISTINCT FROM NEW.market_id AND OLD.market_id IS NOT NULL THEN
      PERFORM public.refresh_market_is_ready(OLD.market_id);
    END IF;
  END IF;

  IF v_market_id IS NOT NULL THEN
    PERFORM public.refresh_market_is_ready(v_market_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger en shipping_routes
DROP TRIGGER IF EXISTS tr_market_ready_from_route ON public.shipping_routes;
CREATE TRIGGER tr_market_ready_from_route
AFTER INSERT OR UPDATE OF market_id, is_active OR DELETE
ON public.shipping_routes
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_market_ready_from_route();

-- 2B: Trigger en shipping_tiers (tiene route_id → necesita JOIN a shipping_routes para obtener market_id)
CREATE OR REPLACE FUNCTION public.trg_refresh_market_ready_from_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_market_id UUID;
  v_route_id  UUID;
BEGIN
  v_route_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END;

  SELECT market_id INTO v_market_id
  FROM public.shipping_routes
  WHERE id = v_route_id;

  IF v_market_id IS NOT NULL THEN
    PERFORM public.refresh_market_is_ready(v_market_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger en shipping_tiers
DROP TRIGGER IF EXISTS tr_market_ready_from_tier ON public.shipping_tiers;
CREATE TRIGGER tr_market_ready_from_tier
AFTER INSERT OR UPDATE OF route_id, is_active OR DELETE
ON public.shipping_tiers
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_market_ready_from_tier();

-- ============================================================
-- PASO 5: Recalcular is_ready para TODOS los mercados existentes
--         (sincronizar estado actual con la nueva lógica)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.markets LOOP
    PERFORM public.refresh_market_is_ready(r.id);
  END LOOP;
  RAISE NOTICE 'is_ready recalculado para todos los mercados';
END;
$$;

-- ============================================================
-- PASO 6: Validación
-- ============================================================
SELECT
  m.id,
  m.name,
  m.is_ready,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.is_active = true)  AS rutas_activas,
  COUNT(DISTINCT st.id) FILTER (WHERE st.is_active = true)  AS tiers_activos
FROM public.markets m
LEFT JOIN public.shipping_routes sr ON sr.market_id = m.id
LEFT JOIN public.shipping_tiers   st ON st.route_id  = sr.id
GROUP BY m.id, m.name, m.is_ready
ORDER BY m.name;

-- RESULTADO ESPERADO:
-- Mercados con rutas + tiers activos → is_ready = true
-- Mercados sin rutas o sin tiers     → is_ready = false
