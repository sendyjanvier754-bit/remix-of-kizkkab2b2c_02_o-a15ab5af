-- =============================================================================
-- FIX COMBINADO: función calculate_shipping_cost_cart + vista v_business_panel_data
--
-- ORDEN CRÍTICO (corrige error 2BP01):
--   1. DROP VIEW primero  → elimina la dependencia
--   2. DROP FUNCTION      → ahora no hay dependientes, sin CASCADE
--   3. CREATE FUNCTION    → nueva versión lee de shipping_tiers
--   4. CREATE VIEW        → usa la nueva función
--
-- Fecha: 2026-02-22
-- =============================================================================

-- ─── PASO 1: Eliminar la vista que depende de la función ──────────────────────
DROP VIEW IF EXISTS public.v_business_panel_data;

-- ─── PASO 2: Eliminar overloads anteriores de la función ──────────────────────
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(UUID, NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, VARCHAR);

-- ─── PASO 3: Nueva función — lee de shipping_tiers ───────────────────────────
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
  -- Peso redondeado al kg superior
  v_weight_rounded := CEIL(p_total_weight_kg);

  -- Leer tarifas del tier configurado por el admin (shipping_tiers)
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

  -- Sin fallback: si no hay tier → retornar vacío (NULL en LATERAL → advertencia frontend)
  IF v_tramo_a_cost IS NULL THEN
    RETURN;
  END IF;

  -- Costo base: tramo A ($/kg) + tramo B
  -- NOTA: tramo_b_cost_per_lb en DB ya almacena el valor $/kg × 2.20462
  --       (la UI auto-calcula al guardar: kg_cost × 2.20462 → campo per_lb)
  --       Por eso NO se vuelve a multiplicar por 2.20462 aquí.
  v_base_cost := (v_weight_rounded * v_tramo_a_cost)
               + (v_weight_rounded * v_tramo_b_cost);

  -- Surcharge oversize (+15%)
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- Surcharge dimensional (+10% si volumen > 0.15 m³)
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

  -- Extra cost por tipo de envío
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

  -- Resultado
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
   Sin fallback: si no hay tier activo para la ruta, retorna vacío → NULL en LATERAL.
   Parámetros:
     p_route_id         → markets.shipping_route_id del usuario
     p_total_weight_kg  → peso real del carrito / producto
     p_tier_type        → "standard" (default) o "express"
     p_shipping_type_id → surcharge adicional (optional)
     p_is_oversize      → +15% si TRUE
     p_length/width/height_cm → +10% si volumen > 0.15 m³';

-- ─── PASO 4: Recrear la vista ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_business_panel_data AS

WITH user_country AS (
  -- País destino del mercado configurado en la tienda del usuario (auth.uid())
  -- get_product_shipping_cost_by_country resuelve la ruta internamente a partir del country_id.
  SELECT m.destination_country_id AS country_id
  FROM   public.stores s
  JOIN   public.markets m ON s.market_id = m.id
  WHERE  s.owner_user_id             = auth.uid()
    AND  s.market_id                 IS NOT NULL
    AND  m.destination_country_id    IS NOT NULL
    AND  m.is_active                 = TRUE
  LIMIT 1
)

-- ─── RAMA 1: PRODUCTOS (sin variante) ────────────────────────────────────────
SELECT
  vp.id                           AS product_id,
  NULL::uuid                      AS variant_id,
  vp.nombre                       AS item_name,
  vp.sku_interno                  AS sku,
  'product'                       AS item_type,
  vp.precio_b2b                   AS cost_per_unit,

  -- Peso para mostrar en la UI (v_logistics_data ya tiene COALESCE peso_g/kg)
  COALESCE(ld.weight_kg, 0)       AS weight_kg,

  -- Costo de envío: misma función que Mi Catálogo → resultados consistentes
  sc.shipping_cost_usd            AS shipping_cost_per_unit,

  -- PVP Sugerido = precio_B2B × 3 + costo_envío
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vp.precio_b2b                   AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  -- Ganancia = PVP - precio_B2B - envío = (precio_B2B × 3 + envío) - precio_B2B - envío = precio_B2B × 2
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vp.precio_b2b * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  -- Margen = ganancia / PVP × 100
  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b > 0
    THEN ROUND((
      (vp.precio_b2b * 2)
      / (vp.precio_b2b * 3 + sc.shipping_cost_usd)
      * 100
    )::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vp.is_active,
  NOW()                           AS last_updated

FROM public.v_productos_con_precio_b2b vp
LEFT JOIN public.v_logistics_data ld
       ON vp.id = ld.product_id AND ld.variant_id IS NULL
LEFT JOIN LATERAL (
  SELECT shipping_cost_usd
  FROM public.get_product_shipping_cost_by_country(
    vp.id,
    (SELECT country_id FROM user_country LIMIT 1),
    'standard'
  )
  LIMIT 1
) sc ON (SELECT country_id FROM user_country LIMIT 1) IS NOT NULL
WHERE vp.is_active = TRUE

UNION ALL

-- ─── RAMA 2: VARIANTES ───────────────────────────────────────────────────────
SELECT
  vv.product_id,
  vv.id                           AS variant_id,
  vv.name                         AS item_name,
  vv.sku                          AS sku,
  'variant'                       AS item_type,
  vv.precio_b2b_final             AS cost_per_unit,

  COALESCE(ld.weight_kg, 0)       AS weight_kg,

  sc.shipping_cost_usd            AS shipping_cost_per_unit,

  -- PVP Sugerido = precio_B2B × 3 + costo_envío
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vv.precio_b2b_final             AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  -- Ganancia = precio_B2B × 2
  CASE WHEN sc.shipping_cost_usd IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  -- Margen = ganancia / PVP × 100
  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final > 0
    THEN ROUND((
      (vv.precio_b2b_final * 2)
      / (vv.precio_b2b_final * 3 + sc.shipping_cost_usd)
      * 100
    )::NUMERIC, 1)
    ELSE NULL
  END                             AS margin_percentage,

  vv.is_active,
  NOW()                           AS last_updated

FROM public.v_variantes_con_precio_b2b vv
LEFT JOIN public.v_logistics_data ld ON vv.id = ld.variant_id
LEFT JOIN LATERAL (
  -- Para variantes se pasa el product_id padre (la función lee peso de products)
  SELECT shipping_cost_usd
  FROM public.get_product_shipping_cost_by_country(
    vv.product_id,
    (SELECT country_id FROM user_country LIMIT 1),
    'standard'
  )
  LIMIT 1
) sc ON (SELECT country_id FROM user_country LIMIT 1) IS NOT NULL
WHERE vv.is_active = TRUE;

-- Permisos
GRANT SELECT ON public.v_business_panel_data TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- SELECT item_name, sku, weight_kg, shipping_cost_per_unit
-- FROM v_business_panel_data
-- LIMIT 10;
--
-- shipping_cost_per_unit > 0   → OK, costo calculado con el país del mercado principal
-- shipping_cost_per_unit = NULL → no hay mercado activo con destination_country_id configurado
--
-- NOTA: La vista depende de auth.uid() → cada usuario ve el costo de envío
--       hacia el país destino configurado en su tienda (stores.market_id → markets.destination_country_id).
--       Si el usuario no tiene mercado configurado, shipping_cost_per_unit = NULL.
-- =============================================================================
