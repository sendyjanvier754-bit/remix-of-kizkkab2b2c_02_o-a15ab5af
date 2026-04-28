-- 1) Seed default platform_fee and profit_margin in price_settings if missing
INSERT INTO public.price_settings (key, value, description, is_active)
VALUES 
  ('platform_fee', 12, 'Tarifa de plataforma aplicada al precio B2B (porcentaje)', true),
  ('profit_margin', 30, 'Margen de ganancia por defecto (porcentaje)', true)
ON CONFLICT (key) DO NOTHING;

-- 2) Recreate the v_productos_con_precio_b2b view to:
--    - Use b2b_margin_ranges (already does)
--    - Use configured platform_fee from price_settings (instead of hardcoded 0.12)
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE VIEW public.v_productos_con_precio_b2b AS
WITH platform_cfg AS (
  SELECT COALESCE(
    (SELECT value FROM public.price_settings WHERE key = 'platform_fee' AND is_active = true LIMIT 1),
    12
  ) / 100.0 AS platform_fee_rate
)
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,
  ( SELECT bmr.margin_percent
      FROM public.b2b_margin_ranges bmr
     WHERE bmr.is_active = true
       AND p.costo_base_excel >= bmr.min_cost
       AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
     ORDER BY bmr.sort_order
     LIMIT 1
  ) AS applied_margin_percent,
  ( SELECT round(
              p.costo_base_excel
              * (1::numeric + bmr.margin_percent / 100.0)
              * (1::numeric + (SELECT platform_fee_rate FROM platform_cfg)),
              2)
      FROM public.b2b_margin_ranges bmr
     WHERE bmr.is_active = true
       AND p.costo_base_excel IS NOT NULL
       AND p.costo_base_excel > 0::numeric
       AND p.costo_base_excel >= bmr.min_cost
       AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
     ORDER BY bmr.sort_order
     LIMIT 1
  ) AS precio_b2b,
  ( SELECT round(p.costo_base_excel * bmr.margin_percent / 100.0, 2)
      FROM public.b2b_margin_ranges bmr
     WHERE bmr.is_active = true
       AND p.costo_base_excel >= bmr.min_cost
       AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
     ORDER BY bmr.sort_order
     LIMIT 1
  ) AS margin_value,
  ( SELECT round(
              p.costo_base_excel
              * (1::numeric + bmr.margin_percent / 100.0)
              * (SELECT platform_fee_rate FROM platform_cfg),
              2)
      FROM public.b2b_margin_ranges bmr
     WHERE bmr.is_active = true
       AND p.costo_base_excel >= bmr.min_cost
       AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
     ORDER BY bmr.sort_order
     LIMIT 1
  ) AS platform_fee,
  ( SELECT (SELECT platform_fee_rate FROM platform_cfg) * 100 ) AS platform_fee_percent,
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  p.moq,
  p.stock_fisico,
  p.stock_status,
  p.imagen_principal,
  p.galeria_imagenes,
  p.categoria_id,
  p.proveedor_id,
  p.origin_country_id,
  p.currency_code,
  p.url_origen,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g::numeric / 1000.0, 0::numeric) AS peso_kg,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g::numeric / 1000.0, 0::numeric) AS weight_kg,
  p.dimensiones_cm,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.is_oversize,
  p.shipping_mode,
  p.is_active,
  p.is_parent,
  p.created_at,
  p.updated_at,
  p.last_calculated_at,
  p.owner_user_id,
  p.owner_role,
  p.approval_status,
  gp.business_name AS owner_business_name,
  gp.logo_url AS owner_logo_url,
  gp.verification_status AS owner_verification_status
FROM public.products p
LEFT JOIN public.grossiste_profiles gp ON gp.user_id = p.owner_user_id
WHERE p.is_active = true
  AND (p.approval_status = 'approved'::text
       OR p.owner_role = 'admin'::public.app_role
       OR p.owner_user_id IS NULL);