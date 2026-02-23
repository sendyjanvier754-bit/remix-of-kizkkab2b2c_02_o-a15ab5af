-- =============================================================================
-- FIX: calculate_shipping_cost_cart — lee de shipping_tiers en lugar de
--      route_logistics_costs (tabla legacy sin datos reales del admin)
-- =============================================================================
-- Cambios:
--   - Agrega p_tier_type VARCHAR DEFAULT 'standard'
--   - Lee tramo_a_cost_per_kg + tramo_b_cost_per_lb de shipping_tiers
--   - Sin fallback: si no hay tier → NULL (frontend muestra advertencia)
--   - Sin mínimos (tramo_a_min_cost / tramo_b_min_cost no se aplican)
--   - Mantiene firma compatible: todos los parámetros existentes siguen igual
--
-- Fecha: 2026-02-22
-- =============================================================================

-- Eliminar todas las versiones anteriores (overloads con distinta firma)
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, VARCHAR);

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_route_id         UUID,
  p_total_weight_kg  NUMERIC,
  p_shipping_type_id UUID    DEFAULT NULL,
  p_is_oversize      BOOLEAN DEFAULT FALSE,
  p_length_cm        NUMERIC DEFAULT NULL,
  p_width_cm         NUMERIC DEFAULT NULL,
  p_height_cm        NUMERIC DEFAULT NULL,
  p_tier_type        VARCHAR DEFAULT 'standard'
)
RETURNS TABLE (
  weight_rounded_kg       NUMERIC,
  base_cost               NUMERIC,
  oversize_surcharge      NUMERIC,
  dimensional_surcharge   NUMERIC,
  extra_cost              NUMERIC,
  total_cost_with_type    NUMERIC,
  shipping_type_name      VARCHAR,
  shipping_type_display   VARCHAR,
  volume_m3               NUMERIC
) AS $$
DECLARE
  v_tramo_a_cost        NUMERIC;
  v_tramo_b_cost        NUMERIC;
  v_base_cost           NUMERIC;
  v_extra_cost_fixed    NUMERIC;
  v_extra_cost_percent  NUMERIC;
  v_extra_cost          NUMERIC := 0;
  v_total_extra         NUMERIC := 0;
  v_type_name           VARCHAR;
  v_type_display        VARCHAR;
  v_weight_rounded      NUMERIC;
  v_oversize_surcharge  NUMERIC := 0;
  v_dim_surcharge       NUMERIC := 0;
  v_volume_m3           NUMERIC := 0;
BEGIN
  -- ── Peso redondeado al kg superior (CEIL) ──────────────────────────────────
  v_weight_rounded := CEIL(p_total_weight_kg);

  -- ── Leer tarifas del tier configurado por el admin (shipping_tiers) ────────
  SELECT
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb
  INTO
    v_tramo_a_cost,
    v_tramo_b_cost
  FROM public.shipping_tiers st
  WHERE st.route_id  = p_route_id
    AND st.is_active = TRUE
    AND LOWER(st.tier_type) = LOWER(p_tier_type)
  ORDER BY st.priority_order ASC NULLS LAST
  LIMIT 1;

  -- Sin fallback: si no hay tier → retornar vacío
  -- (el frontend detecta NULL y muestra advertencia)
  IF v_tramo_a_cost IS NULL THEN
    RETURN;
  END IF;

  -- ── Costo base: tramo A ($/kg) + tramo B ($/lb) ───────────────────────────
  -- Tramo A: China → Hub  | Tramo B: Hub → Destino
  v_base_cost := (v_weight_rounded * v_tramo_a_cost)
               + (v_weight_rounded * 2.20462 * v_tramo_b_cost);

  -- ── Surcharge oversize (+15%) ──────────────────────────────────────────────
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- ── Surcharge dimensional (+10% si volumen > 0.15 m³) ─────────────────────
  IF p_length_cm IS NOT NULL
     AND p_width_cm  IS NOT NULL
     AND p_height_cm IS NOT NULL THEN

    v_volume_m3 := ROUND(
      (p_length_cm * p_width_cm * p_height_cm / 1000000.0)::NUMERIC, 6
    );

    IF v_volume_m3 > 0.15 THEN
      v_dim_surcharge := ROUND((v_base_cost * 0.10)::NUMERIC, 2);
    END IF;
  END IF;

  -- ── Extra cost por tipo de envío ───────────────────────────────────────────
  IF p_shipping_type_id IS NOT NULL THEN
    SELECT
      type,
      display_name,
      extra_cost_fixed,
      extra_cost_percent
    INTO v_type_name, v_type_display, v_extra_cost_fixed, v_extra_cost_percent
    FROM public.shipping_type_configs
    WHERE id = p_shipping_type_id
      AND is_active = TRUE;

    v_total_extra := COALESCE(v_extra_cost_fixed, 0)
                   + (v_base_cost * COALESCE(v_extra_cost_percent, 0) / 100);
    v_extra_cost  := v_total_extra;
  END IF;

  -- ── Resultado ──────────────────────────────────────────────────────────────
  RETURN QUERY SELECT
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    v_oversize_surcharge,
    v_dim_surcharge,
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost + v_oversize_surcharge + v_dim_surcharge)::NUMERIC, 2),
    v_type_name,
    v_type_display,
    v_volume_m3;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, VARCHAR) IS
  'Calcula costo de envío leyendo tarifas de shipping_tiers (admin-configurable).
   Sin fallback: si no hay tier activo para la ruta, retorna vacío (NULL).
   Sin mínimos por tramo.
   Parámetros:
     p_route_id        → markets.shipping_route_id del usuario
     p_total_weight_kg → peso real del carrito / producto
     p_tier_type       → "standard" (default) o "express"
     p_shipping_type_id → surcharge adicional (optional)
     p_is_oversize     → +15% si TRUE
     p_length/width/height_cm → +10% si volumen > 0.15 m³';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Reemplaza los UUIDs con valores reales de tu BD:
--
-- SELECT * FROM calculate_shipping_cost_cart(
--   '<route_id>',   -- markets.shipping_route_id
--   1.5,            -- peso kg
--   NULL, FALSE, NULL, NULL, NULL,
--   'standard'
-- );
--
-- base_cost debe usar tramo_a + tramo_b de shipping_tiers, no route_logistics_costs.
-- Si retorna vacío → shipping_tiers no tiene tier 'standard' activo para esa ruta.
-- =============================================================================
