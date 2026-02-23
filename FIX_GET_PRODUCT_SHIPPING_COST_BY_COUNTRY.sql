-- =============================================================================
-- FIX: get_product_shipping_cost_by_country — peso usa COALESCE
-- =============================================================================
-- Problema:
--   La función leía COALESCE(p.peso_kg, 0) solamente.
--   Si el admin guardó el peso en products.peso_g (gramos), peso_kg es NULL
--   → la función retorna is_available=FALSE → columna Logística vacía en Mi Catálogo
--
-- Solución:
--   COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0)
--   (igual que v_productos_con_precio_b2b y v_logistics_data)
--
-- Fecha: 2026-02-22
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_product_shipping_cost_by_country(
  p_product_id             UUID,
  p_destination_country_id UUID,
  p_tier_type              TEXT DEFAULT 'standard'
)
RETURNS TABLE (
  product_id               UUID,
  product_name             TEXT,
  product_weight_kg        NUMERIC,
  product_weight_lb        NUMERIC,
  destination_country      TEXT,
  destination_country_code TEXT,
  route_id                 UUID,
  tier_type                TEXT,
  tier_name                TEXT,
  tramo_a_cost             NUMERIC,
  tramo_b_cost             NUMERIC,
  shipping_cost_usd        NUMERIC,
  eta_min_days             INTEGER,
  eta_max_days             INTEGER,
  is_available             BOOLEAN,
  error_message            TEXT
) AS $$
DECLARE
  v_weight_kg              NUMERIC;
  v_weight_lb              NUMERIC;
  v_product_name           TEXT;
  v_country_name           TEXT;
  v_country_code           TEXT;
  v_route_id               UUID;
  v_tier_id                UUID;
  v_tier_type              TEXT;
  v_tier_name              TEXT;
  v_tramo_a_cost_per_kg    NUMERIC;
  v_tramo_a_eta_min        INT;
  v_tramo_a_eta_max        INT;
  v_tramo_b_cost_per_lb    NUMERIC;
  v_tramo_b_eta_min        INT;
  v_tramo_b_eta_max        INT;
  v_tramo_a                NUMERIC;
  v_tramo_b                NUMERIC;
  v_total_usd              NUMERIC;
  v_is_available           BOOLEAN := TRUE;
  v_error                  TEXT    := NULL;
BEGIN
  -- ── PASO 1: Obtener peso del producto ──────────────────────────────────────
  -- ✅ FIX: COALESCE cubre peso_kg, weight_kg y peso_g (gramos → kg)
  SELECT
    p.nombre,
    COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0)
  INTO v_product_name, v_weight_kg
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_weight_kg IS NULL OR v_weight_kg = 0 THEN
    v_error := 'Producto no encontrado o sin peso definido';
    v_is_available := FALSE;
    RETURN QUERY SELECT p_product_id, v_product_name,
      NULL::NUMERIC, NULL::NUMERIC,
      NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, NULL::INT,
      v_is_available, v_error;
    RETURN;
  END IF;

  -- Convertir a libras (1 kg = 2.20462 lb)
  v_weight_lb := v_weight_kg * 2.20462;

  -- ── PASO 2: Validar país ────────────────────────────────────────────────────
  SELECT dc.name, dc.code INTO v_country_name, v_country_code
  FROM public.destination_countries dc
  WHERE dc.id = p_destination_country_id AND dc.is_active = TRUE;

  IF v_country_name IS NULL THEN
    v_error := 'País no disponible o inactivo';
    v_is_available := FALSE;
    RETURN QUERY SELECT p_product_id, v_product_name, v_weight_kg, v_weight_lb,
      NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, NULL::INT,
      v_is_available, v_error;
    RETURN;
  END IF;

  -- ── PASO 3+4: Obtener ruta + tier (JOIN directo) ───────────────────────────
  SELECT
    sr.id,
    st.id, st.tier_type,
    COALESCE(NULLIF(st.custom_tier_name, ''), st.tier_name),
    st.tramo_a_cost_per_kg,
    st.tramo_a_eta_min, st.tramo_a_eta_max,
    st.tramo_b_cost_per_lb,
    st.tramo_b_eta_min, st.tramo_b_eta_max
  INTO
    v_route_id,
    v_tier_id, v_tier_type, v_tier_name,
    v_tramo_a_cost_per_kg,
    v_tramo_a_eta_min, v_tramo_a_eta_max,
    v_tramo_b_cost_per_lb,
    v_tramo_b_eta_min, v_tramo_b_eta_max
  FROM public.shipping_routes sr
  JOIN public.shipping_tiers st ON st.route_id = sr.id
  WHERE sr.destination_country_id = p_destination_country_id
    AND sr.is_active  = TRUE
    AND st.tier_type  = p_tier_type
    AND st.is_active  = TRUE
  ORDER BY st.priority_order ASC
  LIMIT 1;

  -- Fallback: si no hay tier del tipo pedido, buscar cualquier tier activo
  IF v_route_id IS NULL THEN
    SELECT
      sr.id,
      st.id, st.tier_type,
      COALESCE(NULLIF(st.custom_tier_name, ''), st.tier_name),
      st.tramo_a_cost_per_kg,
      st.tramo_a_eta_min, st.tramo_a_eta_max,
      st.tramo_b_cost_per_lb,
      st.tramo_b_eta_min, st.tramo_b_eta_max
    INTO
      v_route_id,
      v_tier_id, v_tier_type, v_tier_name,
      v_tramo_a_cost_per_kg,
      v_tramo_a_eta_min, v_tramo_a_eta_max,
      v_tramo_b_cost_per_lb,
      v_tramo_b_eta_min, v_tramo_b_eta_max
    FROM public.shipping_routes sr
    JOIN public.shipping_tiers st ON st.route_id = sr.id
    WHERE sr.destination_country_id = p_destination_country_id
      AND sr.is_active = TRUE
      AND st.is_active = TRUE
    ORDER BY st.priority_order ASC
    LIMIT 1;
  END IF;

  IF v_route_id IS NULL THEN
    v_error := 'No hay ruta/tier activo para este país';
    v_is_available := FALSE;
    RETURN QUERY SELECT p_product_id, v_product_name, v_weight_kg, v_weight_lb,
      v_country_name, v_country_code, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, NULL::INT,
      v_is_available, v_error;
    RETURN;
  END IF;

  -- ── PASO 5: Calcular costo ─────────────────────────────────────────────────
  -- Sin redondeo (el redondeo CEIL es responsabilidad del carrito)
  -- NOTA: tramo_b_cost_per_lb en DB ya almacena el valor $/kg × 2.20462
  --       (la UI auto-calcula al guardar), por eso se multiplica por peso_kg
  --       directamente sin conversión adicional.
  v_tramo_a   := v_weight_kg * v_tramo_a_cost_per_kg;
  v_tramo_b   := v_weight_kg * v_tramo_b_cost_per_lb;
  v_total_usd := v_tramo_a + v_tramo_b;

  -- ── RETORNAR ───────────────────────────────────────────────────────────────
  RETURN QUERY SELECT
    p_product_id,
    v_product_name,
    v_weight_kg,
    v_weight_lb,
    v_country_name,
    v_country_code,
    v_route_id,
    v_tier_type,
    v_tier_name,
    ROUND(v_tramo_a::NUMERIC, 4),
    ROUND(v_tramo_b::NUMERIC, 4),
    ROUND(v_total_usd::NUMERIC, 4),
    (v_tramo_a_eta_min + v_tramo_b_eta_min),
    (v_tramo_a_eta_max + v_tramo_b_eta_max),
    v_is_available,
    v_error;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.get_product_shipping_cost_by_country TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Reemplaza los UUIDs con valores reales:
--
-- SELECT product_weight_kg, shipping_cost_usd, tier_type, is_available, error_message
-- FROM get_product_shipping_cost_by_country('<product_id>', '<destination_country_id>', 'standard');
--
-- product_weight_kg debe ser > 0 para productos con solo peso_g configurado.
-- =============================================================================
