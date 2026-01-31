-- ============================================
-- ACTUALIZACIÓN BD: Motores Separados + ETA
-- Fecha: 31-01-2026
-- Propósito: Separar precio de logística + agregar ETA
-- ============================================

-- ============================================
-- 1. CREAR FUNCIÓN: calculate_route_cost() CON ETA
-- ============================================
-- Función que calcula SOLO logística (sin precios)
-- Retorna: costo + desglose + ETA (fechas reales)

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
  -- Validar inputs
  IF p_weight_kg IS NULL OR p_weight_kg <= 0 THEN
    p_weight_kg := 1;
  END IF;
  
  -- 1. Calcular TRAMO A (China → Hub Tránsito)
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
  
  -- 2. Calcular TRAMO B (Hub Tránsito → País Destino)
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
  
  -- 3. Total de logística
  v_total_logistics := v_costo_tramo_a + v_costo_tramo_b;
  
  -- 4. Retornar objeto JSON con desglose Y ETA
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

-- ============================================
-- 2. ACTUALIZAR VISTA: v_productos_con_precio_b2b
-- ============================================
-- IMPORTANTE: Actualizar la vista existente
-- Cambios: 
--   • Remover cálculo de logística
--   • Mantener SOLO precio_base
--   • Mantener weight_kg para logística posterior
--   • Usar calculate_base_price_only si existe, sino usar calculate_b2b_price

-- Verificar si existe calculate_base_price_only, si no, crearla
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
  -- 1. Obtener costo base del producto
  SELECT costo_base_excel
  INTO v_costo_fabrica
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_fabrica IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 2. Calcular MARGEN
  v_margin_value := v_costo_fabrica * (p_margin_percent / 100.0);
  
  -- 3. Calcular FEE DE PLATAFORMA (12% sobre costo + margen)
  v_fee_plataforma := (v_costo_fabrica + v_margin_value) * 0.12;
  
  -- 4. PRECIO BASE FINAL
  v_base_price := v_costo_fabrica + v_margin_value + v_fee_plataforma;
  
  RETURN ROUND(v_base_price::numeric, 2);
END;
$$;

-- Ahora actualizar la vista
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  
  -- COSTOS INTERNOS
  p.costo_base_excel AS costo_fabrica,
  p.precio_mayorista_base,
  
  -- PRECIO BASE DINÁMICO (SIN LOGÍSTICA)
  -- Incluye: costo_fabrica + margen (30%) + platform_fees (12%)
  -- NO depende de ruta ni logística
  COALESCE(
    public.calculate_base_price_only(p.id, 30),
    public.calculate_b2b_price(p.id, NULL, NULL),
    p.precio_mayorista_base,
    0
  ) AS precio_b2b,
  
  -- DESGLOSE DE PRECIO (para referencia)
  ROUND((p.costo_base_excel * 0.30)::numeric, 2) AS margin_value,
  ROUND((
    (p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12
  )::numeric, 2) AS platform_fee,
  
  -- Campos adicionales de precio (referencias)
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Información de stock
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
  
  -- Configuración DE ENVÍO (para cálculo de logística posterior)
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
  
  -- Estado
  p.is_active,
  p.is_parent,
  
  -- Timestamps
  p.created_at,
  p.updated_at,
  p.last_calculated_at
  
FROM public.products p
WHERE p.is_active = true;

-- ============================================
-- 3. VISTA: v_productos_precio_base (alias)
-- ============================================
-- Alias para mayor claridad
-- Esta vista es idéntica a v_productos_con_precio_b2b
-- pero con nombre más explícito

DROP VIEW IF EXISTS public.v_productos_precio_base CASCADE;

CREATE VIEW public.v_productos_precio_base AS
SELECT * FROM public.v_productos_con_precio_b2b;

-- ============================================
-- 4. VISTA: v_rutas_logistica
-- ============================================
-- Vista para obtener rutas con desglose de segmentos

DROP VIEW IF EXISTS public.v_rutas_logistica CASCADE;

CREATE VIEW public.v_rutas_logistica AS
SELECT
  sr.id AS route_id,
  sr.destination_country_id,
  dc.nombre AS destination_country_name,
  dc.code AS country_code,
  sr.transit_hub_id,
  th.nombre AS transit_hub_name,
  sr.is_direct,
  sr.is_active,
  
  -- TRAMO A: China → Hub
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
  
  -- TRAMO B: Hub → Destino
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

-- ============================================
-- 5. PERMISOS
-- ============================================
-- Asegurar que las vistas son accesibles

GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_precio_base TO anon, authenticated;
GRANT SELECT ON public.v_rutas_logistica TO anon, authenticated;

-- ============================================
-- 6. VERIFICACIÓN
-- ============================================
-- Ejecutar después de aplicar el script

/*
-- Test 1: Verificar que v_productos_con_precio_b2b tiene SOLO precio
SELECT 
  id, 
  sku_interno, 
  precio_b2b, 
  weight_kg,
  margin_value,
  platform_fee
FROM public.v_productos_con_precio_b2b 
LIMIT 1;

-- Test 2: Verificar que calculate_route_cost retorna ETA
SELECT calculate_route_cost(
  (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
  5.0
) AS logistics;

-- Test 3: Verificar que ETA tiene fechas reales
SELECT 
  (calculate_route_cost(
    (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
    5.0
  )->'eta_date_min')::text AS eta_min,
  (calculate_route_cost(
    (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
    5.0
  )->'eta_date_max')::text AS eta_max;
*/

-- ============================================
-- FIN DE SCRIPT
-- ============================================
COMMIT;
