-- MOTORES SEPARADOS + ETA
-- 31-01-2026

CREATE OR REPLACE FUNCTION public.calculate_route_cost(
  p_route_id UUID,
  p_weight_kg NUMERIC,
  p_weight_cbm NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_tramo_a NUMERIC := 0;
  v_costo_tramo_b NUMERIC := 0;
  v_total_logistics NUMERIC;
  v_days_min INTEGER := 0;
  v_days_max INTEGER := 0;
  v_result JSONB;
BEGIN
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 THEN
    p_weight_kg := 1;
  END IF;
  
  SELECT 
    CASE 
      WHEN COALESCE(rlc.cost_per_kg, 0) > 0 
        THEN GREATEST(rlc.cost_per_kg * p_weight_kg, COALESCE(rlc.min_cost, 0))
      ELSE COALESCE(rlc.min_cost, 0)
    END,
    COALESCE(rlc.estimated_days_min, 0),
    COALESCE(rlc.estimated_days_max, 0)
  INTO v_costo_tramo_a, v_days_min, v_days_max
  FROM public.route_logistics_costs rlc
  WHERE rlc.shipping_route_id = p_route_id
    AND rlc.segment = 'china_to_transit'
    AND rlc.is_active = true
  LIMIT 1;
  
  v_costo_tramo_a := COALESCE(v_costo_tramo_a, 0);
  
  SELECT 
    CASE 
      WHEN COALESCE(rlc.cost_per_kg, 0) > 0 
        THEN GREATEST(rlc.cost_per_kg * p_weight_kg, COALESCE(rlc.min_cost, 0))
      ELSE COALESCE(rlc.min_cost, 0)
    END,
    COALESCE(rlc.estimated_days_min, 0),
    COALESCE(rlc.estimated_days_max, 0)
  INTO v_costo_tramo_b, v_days_min, v_days_max
  FROM public.route_logistics_costs rlc
  WHERE rlc.shipping_route_id = p_route_id
    AND rlc.segment = 'transit_to_destination'
    AND rlc.is_active = true
  LIMIT 1;
  
  v_costo_tramo_b := COALESCE(v_costo_tramo_b, 0);
  
  v_total_logistics := v_costo_tramo_a + v_costo_tramo_b;
  
  v_result := jsonb_build_object(
    'total_cost', ROUND(v_total_logistics::numeric, 2),
    'tramo_a_china_to_hub', ROUND(v_costo_tramo_a::numeric, 2),
    'tramo_b_hub_to_destination', ROUND(v_costo_tramo_b::numeric, 2),
    'estimated_days_min', v_days_min,
    'estimated_days_max', v_days_max,
    'eta_date_min', (NOW() + (v_days_min || ' days')::INTERVAL)::DATE,
    'eta_date_max', (NOW() + (v_days_max || ' days')::INTERVAL)::DATE
  );
  
  RETURN v_result;
END;
$$;

-- Función: calculate_base_price_only()

CREATE OR REPLACE FUNCTION public.calculate_base_price_only(
  p_product_id UUID,
  p_margin_percent NUMERIC DEFAULT 30
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_fabrica NUMERIC;
  v_margin_value NUMERIC;
  v_fee_plataforma NUMERIC;
  v_base_price NUMERIC;
BEGIN
  SELECT costo_base_excel
  INTO v_costo_fabrica
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_fabrica IS NULL THEN
    RETURN 0;
  END IF;
  
  v_margin_value := v_costo_fabrica * (p_margin_percent / 100.0);
  
  v_fee_plataforma := (v_costo_fabrica + v_margin_value) * 0.12;
  
  v_base_price := v_costo_fabrica + v_margin_value + v_fee_plataforma;
  
  RETURN ROUND(v_base_price::numeric, 2);
END;
$$;

-- Vista: v_productos_con_precio_b2b

DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  p.costo_base_excel,
  p.precio_mayorista_base,
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  COALESCE(public.calculate_base_price_only(p.id, 30), p.precio_mayorista_base, 0) AS precio_b2b,
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
  p.peso_kg,
  p.weight_kg,
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
  p.last_calculated_at
FROM public.products p
WHERE p.is_active = true;

-- Vista: v_productos_precio_base

DROP VIEW IF EXISTS public.v_productos_precio_base CASCADE;

CREATE VIEW public.v_productos_precio_base AS
SELECT * FROM public.v_productos_con_precio_b2b;

-- Vista: v_rutas_logistica

DROP VIEW IF EXISTS public.v_rutas_logistica CASCADE;

CREATE VIEW public.v_rutas_logistica AS
SELECT
  sr.id AS route_id,
  sr.destination_country_id,
  dc.name AS destination_country_name,
  dc.code AS country_code,
  sr.transit_hub_id,
  th.name AS transit_hub_name,
  sr.is_direct,
  sr.is_active,
  
  -- TRAMO A: China → Hub Tránsito
  (SELECT 
    jsonb_build_object(
      'segment', 'china_to_transit',
      'cost_per_kg', COALESCE(rlc.cost_per_kg, 0),
      'min_cost', COALESCE(rlc.min_cost, 0),
      'estimated_days_min', rlc.estimated_days_min,
      'estimated_days_max', rlc.estimated_days_max
    )
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = sr.id
     AND rlc.segment = 'china_to_transit'
     AND rlc.is_active = true
   LIMIT 1
  ) AS segment_a,
  (SELECT 
    jsonb_build_object(
      'segment', 'transit_to_destination',
      'cost_per_kg', COALESCE(rlc.cost_per_kg, 0),
      'min_cost', COALESCE(rlc.min_cost, 0),
      'estimated_days_min', rlc.estimated_days_min,
      'estimated_days_max', rlc.estimated_days_max
    )
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = sr.id
     AND rlc.segment = 'transit_to_destination'
     AND rlc.is_active = true
   LIMIT 1
  ) AS segment_b
FROM public.shipping_routes sr
LEFT JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
WHERE sr.is_active = true;

GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_precio_base TO anon, authenticated;
GRANT SELECT ON public.v_rutas_logistica TO anon, authenticated;
