-- =============================================================================
-- 🎟️ TICKET #08: FUNCIÓN - COSTO DE ENVÍO POR PRODUCTO
-- =============================================================================
-- OBJETIVO: Obtener costo de envío unitario usando shipping_tiers
-- SIN REDONDEO - Decimales completos
-- ESTADO: Listo para ejecutar (DEPENDE de TICKET #06-07)
-- Tiempo estimado: 5 minutos
-- =============================================================================
--
-- FLUJO DE TABLAS:
--   products → (peso_kg)
--   destination_countries → (validar país activo)
--   shipping_routes → (route_id por destination_country_id)
--   shipping_tiers → (costos por tier: tramo_a_cost_per_kg, tramo_b_cost_per_lb)
--
-- FÓRMULA (SIN min_cost - no existe en tabla real):
--   tramo_a = peso_kg * tramo_a_cost_per_kg
--   tramo_b = peso_lb * tramo_b_cost_per_lb
--   total_usd = tramo_a + tramo_b  (SIN REDONDEO)
--
-- ESTRUCTURA REAL shipping_tiers (CONFIRMADA EN PRODUCCIÓN):
--   id, route_id (FK), tier_type ('standard'|'express'),
--   tier_name, custom_tier_name, transport_type,
--   tramo_a_cost_per_kg, tramo_a_eta_min, tramo_a_eta_max,
--   tramo_b_cost_per_lb, tramo_b_cost_per_kg, tramo_b_eta_min, tramo_b_eta_max,
--   extra_surcharge_percent, extra_surcharge_fixed,
--   allows_oversize, allows_sensitive, is_active, priority_order
--   ⚠️ NO EXISTEN: tramo_a_min_cost, tramo_b_min_cost
-- =============================================================================

-- ✅ FUNCIÓN: Obtener costo de envío unitario para un producto

CREATE OR REPLACE FUNCTION public.get_product_shipping_cost_by_country(
  p_product_id UUID,
  p_destination_country_id UUID,
  p_tier_type TEXT DEFAULT 'standard'  -- 'standard' o 'express'
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_weight_kg NUMERIC,
  product_weight_lb NUMERIC,
  destination_country TEXT,
  destination_country_code TEXT,
  route_id UUID,
  tier_type TEXT,
  tier_name TEXT,
  tramo_a_cost NUMERIC,         -- China → Hub (sin redondeo)
  tramo_b_cost NUMERIC,         -- Hub → Destino (sin redondeo)
  shipping_cost_usd NUMERIC,    -- Total USD (sin redondeo)
  eta_min_days INTEGER,
  eta_max_days INTEGER,
  is_available BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_weight_kg NUMERIC;
  v_weight_lb NUMERIC;
  v_product_name TEXT;
  v_country_name TEXT;
  v_country_code TEXT;
  v_route_id UUID;
  v_tier_id UUID;
  v_tier_type TEXT;
  v_tier_name TEXT;
  v_tramo_a_cost_per_kg NUMERIC;
  v_tramo_a_eta_min INT;
  v_tramo_a_eta_max INT;
  v_tramo_b_cost_per_lb NUMERIC;
  v_tramo_b_eta_min INT;
  v_tramo_b_eta_max INT;
  v_tramo_a NUMERIC;
  v_tramo_b NUMERIC;
  v_total_usd NUMERIC;
  v_is_available BOOLEAN := TRUE;
  v_error TEXT := NULL;
BEGIN
  -- ── PASO 1: Obtener peso del producto ──────────────────────────────────────
  SELECT
    p.nombre,
    COALESCE(p.peso_kg, 0)
  INTO v_product_name, v_weight_kg
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_weight_kg IS NULL OR v_weight_kg = 0 THEN
    v_error := 'Producto no encontrado o sin peso definido';
    v_is_available := FALSE;
    RETURN QUERY SELECT p_product_id, v_product_name, NULL::NUMERIC, NULL::NUMERIC,
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

  -- ── PASO 3+4: Obtener ruta + tier juntos (un JOIN directo) ──────────────────
  -- Haiti tiene rutas DISTINTAS para standard y express, por eso se hace JOIN
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
    AND st.tier_type = p_tier_type
    AND st.is_active = TRUE
  ORDER BY st.priority_order ASC
  LIMIT 1;

  -- Si no hay tier del tipo pedido, buscar cualquier tier activo para ese país
  IF v_tier_id IS NULL THEN
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

  IF v_tier_id IS NULL THEN
    v_error := 'No hay tiers de envío configurados para este país';
    v_is_available := FALSE;
    RETURN QUERY SELECT p_product_id, v_product_name, v_weight_kg, v_weight_lb,
      v_country_name, v_country_code, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, NULL::INT,
      v_is_available, v_error;
    RETURN;
  END IF;

  -- ── PASO 5: Calcular costos (misma fórmula que calculate_shipping_cost_cart, sin CEIL) ──
  -- Tramo A: peso_kg × tramo_a_cost_per_kg
  -- Tramo B: peso_lb × tramo_b_cost_per_lb
  -- SIN redondeo de peso (CEIL es para el carrito, no para el catálogo)
  -- SIN ROUND en el resultado (catálogo muestra decimales completos)
  v_tramo_a := v_weight_kg * v_tramo_a_cost_per_kg;
  v_tramo_b := v_weight_lb * v_tramo_b_cost_per_lb;
  v_total_usd := v_tramo_a + v_tramo_b;

  -- ── PASO 6: Retornar ────────────────────────────────────────────────────────
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
    v_tramo_a,           -- SIN REDONDEO
    v_tramo_b,           -- SIN REDONDEO
    v_total_usd,         -- SIN REDONDEO
    v_tramo_a_eta_min + v_tramo_b_eta_min,
    v_tramo_a_eta_max + v_tramo_b_eta_max,
    TRUE,
    NULL::TEXT;

END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 🧪 TESTING: Probar la función con productos reales
-- =============================================================================

-- Ver tiers disponibles en BD
SELECT
  st.id,
  st.route_id,
  sr.destination_country_id,
  st.tier_type,
  COALESCE(NULLIF(st.custom_tier_name, ''), st.tier_name) as nombre_tier,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.is_active
FROM public.shipping_tiers st
JOIN public.shipping_routes sr ON st.route_id = sr.id
ORDER BY st.tier_type;

-- PROBAR CON LOS 3 PRODUCTOS REALES → Haiti → standard
SELECT
  product_name,
  product_weight_kg,
  product_weight_lb,
  destination_country,
  tier_type,
  tier_name,
  tramo_a_cost,
  tramo_b_cost,
  shipping_cost_usd,   -- ← Columna "Logística" - SIN REDONDEO
  eta_min_days,
  eta_max_days,
  is_available,
  error_message
FROM public.get_product_shipping_cost_by_country(
  '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'::uuid,  -- Tanga (0.3 kg)
  '737ec4c2-5b5a-459b-800c-01a4b1c3fd6a'::uuid,  -- Haiti
  'standard'
)
UNION ALL
SELECT
  product_name, product_weight_kg, product_weight_lb,
  destination_country, tier_type, tier_name,
  tramo_a_cost, tramo_b_cost, shipping_cost_usd,
  eta_min_days, eta_max_days, is_available, error_message
FROM public.get_product_shipping_cost_by_country(
  '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5'::uuid,  -- Camiseta (0.6 kg)
  '737ec4c2-5b5a-459b-800c-01a4b1c3fd6a'::uuid,  -- Haiti
  'standard'
)
UNION ALL
SELECT
  product_name, product_weight_kg, product_weight_lb,
  destination_country, tier_type, tier_name,
  tramo_a_cost, tramo_b_cost, shipping_cost_usd,
  eta_min_days, eta_max_days, is_available, error_message
FROM public.get_product_shipping_cost_by_country(
  '4a53679c-7168-4405-9044-0d6c0dcc0d04'::uuid,  -- Zapatillas (0.6 kg)
  '737ec4c2-5b5a-459b-800c-01a4b1c3fd6a'::uuid,  -- Haiti
  'standard'
);

-- =============================================================================
-- RESULTADOS ESPERADOS (0.3 kg → standard, tramo_a=2.5/kg, tramo_b=11.02/lb):
--   Tanga 0.3kg → tramo_a = 0.3 × 2.5 = 0.75
--              → tramo_b = (0.3 × 2.20462) × 11.0231 = 0.66138 × 11.0231 = 7.292...
--              → total   = 0.75 + 7.292 = 8.042...
-- =============================================================================
