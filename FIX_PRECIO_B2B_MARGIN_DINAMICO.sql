-- =============================================================================
-- FIX: Unificar fórmula de precio B2B en ambas vistas
--
-- PROBLEMA:
--   v_productos_con_precio_b2b  → margen hardcodeado 30% (incorrecto)
--   v_variantes_con_precio_b2b  → margen dinámico de b2b_margin_ranges (correcto)
--   Resultado: card muestra $1.28, drawer muestra $3.94 para el mismo producto
--
-- SOLUCIÓN:
--   Ambas vistas usan b2b_margin_ranges (lookup dinámico)
--   Sin fallback: si no hay rango configurado → NULL (producto sin precio)
--
-- FÓRMULA UNIFICADA:
--   costo_base    = products.costo_base_excel  (productos)
--                 = COALESCE(variants.cost_price, products.costo_base_excel) (variantes)
--   margin        = b2b_margin_ranges.margin_percent  WHERE costo_base IN [min_cost, max_cost)
--   precio_b2b    = costo_base × (1 + margin/100) × 1.12  — o NULL si no hay rango
--
-- Fecha: 2026-02-22
-- =============================================================================

-- Orden de DROP: primero las vistas que dependen de las base
DROP VIEW IF EXISTS public.v_business_panel_data;
DROP VIEW IF EXISTS public.v_productos_precio_base;
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;
DROP VIEW IF EXISTS public.v_variantes_con_precio_b2b CASCADE;
DROP VIEW IF EXISTS public.v_variantes_precio_simple CASCADE;


-- =============================================================================
-- 1. v_productos_con_precio_b2b — margen dinámico sin fallback
-- =============================================================================
CREATE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,

  -- COSTOS INTERNOS
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,

  -- MARGEN dinámico desde b2b_margin_ranges (NULL si no hay rango configurado)
  (SELECT bmr.margin_percent
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  p.costo_base_excel >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
   ORDER BY bmr.sort_order ASC
   LIMIT 1
  ) AS applied_margin_percent,

  -- PRECIO B2B FINAL: costo × (1 + margen%) × 1.12 — NULL sin rango o sin costo
  (SELECT ROUND(
     (p.costo_base_excel * (1 + bmr.margin_percent / 100.0) * 1.12)::numeric, 2
   )
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  p.costo_base_excel IS NOT NULL
     AND  p.costo_base_excel > 0
     AND  p.costo_base_excel >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
   ORDER BY bmr.sort_order ASC
   LIMIT 1
  ) AS precio_b2b,

  -- DESGLOSE (valores informativos, usando el margen dinámico)
  (SELECT ROUND((p.costo_base_excel * bmr.margin_percent / 100.0)::numeric, 2)
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  p.costo_base_excel >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
   ORDER BY bmr.sort_order ASC LIMIT 1
  ) AS margin_value,

  (SELECT ROUND(
     (p.costo_base_excel * (1 + bmr.margin_percent / 100.0) * 0.12)::numeric, 2
   )
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  p.costo_base_excel >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
   ORDER BY bmr.sort_order ASC LIMIT 1
  ) AS platform_fee,

  -- Campos de precio adicionales
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,

  -- Stock
  p.moq,
  p.stock_fisico,
  p.stock_status,

  -- Imágenes
  p.imagen_principal,
  p.galeria_imagenes,

  -- Referencias
  p.categoria_id,
  p.proveedor_id,
  p.origin_country_id,

  -- Configuración
  p.currency_code,
  p.url_origen,

  -- Peso (COALESCE para cubrir todos los campos)
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0) AS peso_kg,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0) AS weight_kg,

  p.dimensiones_cm,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.is_oversize,
  p.shipping_mode,

  -- Estado
  p.is_active,
  p.is_parent,

  -- Timestamps
  p.created_at,
  p.updated_at,
  p.last_calculated_at

FROM public.products p
WHERE p.is_active = true;

-- Alias de compatibilidad
CREATE VIEW public.v_productos_precio_base AS
SELECT * FROM public.v_productos_con_precio_b2b;

GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_precio_base     TO anon, authenticated;


-- =============================================================================
-- 2. v_variantes_con_precio_b2b — misma lógica, sin fallback 30%
-- =============================================================================
CREATE VIEW public.v_variantes_con_precio_b2b AS
SELECT
  pv.id,
  pv.product_id,
  pv.sku,
  pv.name,
  pv.attribute_combination,

  -- Costo base de la variante (propio primero, luego padre)
  COALESCE(pv.cost_price, p.costo_base_excel) AS costo_base_variante,

  -- MARGEN dinámico (NULL si no hay rango)
  (SELECT bmr.margin_percent
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  COALESCE(pv.cost_price, p.costo_base_excel) >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < bmr.max_cost)
   ORDER BY bmr.sort_order ASC
   LIMIT 1
  ) AS applied_margin_percent,

  -- PRECIO B2B FINAL — NULL si no hay rango o no hay costo
  (SELECT ROUND(
     (COALESCE(pv.cost_price, p.costo_base_excel)
       * (1 + bmr.margin_percent / 100.0)
       * 1.12)::numeric, 2
   )
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  COALESCE(pv.cost_price, p.costo_base_excel) IS NOT NULL
     AND  COALESCE(pv.cost_price, p.costo_base_excel) > 0
     AND  COALESCE(pv.cost_price, p.costo_base_excel) >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < bmr.max_cost)
   ORDER BY bmr.sort_order ASC
   LIMIT 1
  ) AS precio_b2b_final,

  -- Otros campos
  pv.price,
  pv.price_adjustment,
  pv.stock,
  pv.moq,
  pv.images,
  pv.is_active,
  p.sku_interno AS parent_sku,
  p.nombre      AS product_name,
  pv.created_at,
  pv.updated_at

FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

-- Vista simplificada (compatibilidad)
CREATE VIEW public.v_variantes_precio_simple AS
SELECT
  pv.id,
  pv.sku,
  pv.product_id,
  pv.attribute_combination,
  COALESCE(pv.cost_price, p.costo_base_excel) AS costo_base_variante,
  (SELECT ROUND(
     (COALESCE(pv.cost_price, p.costo_base_excel)
       * (1 + bmr.margin_percent / 100.0)
       * 1.12)::numeric, 2
   )
   FROM   public.b2b_margin_ranges bmr
   WHERE  bmr.is_active = true
     AND  COALESCE(pv.cost_price, p.costo_base_excel) >= bmr.min_cost
     AND  (bmr.max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < bmr.max_cost)
   ORDER BY bmr.sort_order ASC LIMIT 1
  ) AS precio_b2b_final
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

GRANT SELECT ON public.v_variantes_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_variantes_precio_simple    TO anon, authenticated;


-- =============================================================================
-- 3. v_business_panel_data — sin cambios de fórmula PVP, solo se recrea
--    porque depende de las vistas anteriores (DROP CASCADE las eliminó)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_business_panel_data AS

WITH user_country AS (
  SELECT m.destination_country_id AS country_id
  FROM   public.stores s
  JOIN   public.markets m ON s.market_id = m.id
  WHERE  s.owner_user_id          = auth.uid()
    AND  s.market_id              IS NOT NULL
    AND  m.destination_country_id IS NOT NULL
    AND  m.is_active              = TRUE
  LIMIT 1
)

-- ─── RAMA 1: PRODUCTOS ───────────────────────────────────────────────────────
SELECT
  vp.id                           AS product_id,
  NULL::uuid                      AS variant_id,
  vp.nombre                       AS item_name,
  vp.sku_interno                  AS sku,
  'product'                       AS item_type,
  vp.precio_b2b                   AS cost_per_unit,
  COALESCE(ld.weight_kg, 0)       AS weight_kg,
  sc.shipping_cost_usd            AS shipping_cost_per_unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vp.precio_b2b                   AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b IS NOT NULL
    THEN ROUND((vp.precio_b2b * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b IS NOT NULL
    THEN ROUND((vp.precio_b2b * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vp.precio_b2b IS NOT NULL AND vp.precio_b2b > 0
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

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS suggested_pvp_per_unit,

  vv.precio_b2b_final             AS investment_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 3 + sc.shipping_cost_usd)::NUMERIC, 2)
    ELSE NULL
  END                             AS revenue_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final IS NOT NULL
    THEN ROUND((vv.precio_b2b_final * 2)::NUMERIC, 2)
    ELSE NULL
  END                             AS profit_1unit,

  CASE WHEN sc.shipping_cost_usd IS NOT NULL AND vv.precio_b2b_final IS NOT NULL AND vv.precio_b2b_final > 0
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
  SELECT shipping_cost_usd
  FROM public.get_product_shipping_cost_by_country(
    vv.product_id,
    (SELECT country_id FROM user_country LIMIT 1),
    'standard'
  )
  LIMIT 1
) sc ON (SELECT country_id FROM user_country LIMIT 1) IS NOT NULL
WHERE vv.is_active = TRUE;

GRANT SELECT ON public.v_business_panel_data TO anon, authenticated;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- 1. Ver rangos activos:
-- SELECT min_cost, max_cost, margin_percent FROM b2b_margin_ranges WHERE is_active=true ORDER BY sort_order;
--
-- 2. Comparar producto vs variante (deben coincidir si tienen mismo costo):
-- SELECT
--   'producto' as tipo, sku_interno AS sku, costo_base, applied_margin_percent, precio_b2b
-- FROM v_productos_con_precio_b2b
-- UNION ALL
-- SELECT
--   'variante', sku, costo_base_variante, applied_margin_percent, precio_b2b_final
-- FROM v_variantes_con_precio_b2b
-- LIMIT 20;
--
-- Ejemplo con costo $0.88 y rango $0-$10 → 300%:
--   precio_b2b = $0.88 × (1+3.0) × 1.12 = $3.94
--   (antes: $0.88 × 1.30 × 1.12 = $1.28 → INCORRECTO)
-- =============================================================================
