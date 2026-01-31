-- ============================================
-- SEPARATION OF CONCERNS: Precio vs Logística
-- Migration: Separar motor de precio y logística
-- Date: 2026-01-31
-- ============================================

-- ============================================
-- 1. FUNCIÓN: CALCULAR PRECIO BASE (SIN LOGÍSTICA)
-- ============================================
-- INPUT: product_id, margin_percentage (opcional)
-- OUTPUT: precio_base (costo_fabrica + margin + platform_fees)
-- NO incluye costos de logística
-- Se ejecuta UNA sola vez, sin depender de rutas
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
  
  -- 2. Calcular MARGEN (aplicado al costo base)
  -- Protection Rule: el margen se aplica al costo de fábrica
  v_margin_value := v_costo_fabrica * (p_margin_percent / 100.0);
  
  -- 3. Subtotal: Costo + Margen
  -- v_subtotal_with_margin := v_costo_fabrica + v_margin_value;
  
  -- 4. Calcular FEE DE PLATAFORMA (12% sobre costo + margen)
  -- Platform fee se aplica después del margen
  v_fee_plataforma := (v_costo_fabrica + v_margin_value) * 0.12;
  
  -- 5. PRECIO BASE FINAL (sin logística)
  v_base_price := v_costo_fabrica + v_margin_value + v_fee_plataforma;
  
  RETURN ROUND(v_base_price::numeric, 2);
END;
$$;

-- ============================================
-- 2. FUNCIÓN: CALCULAR COSTO DE LOGÍSTICA
-- ============================================
-- INPUT: route_id, weight_kg, weight_cbm
-- OUTPUT: costo_logistica (Tramo A + Tramo B)
-- PURA LOGÍSTICA, sin considerar precio del producto
-- Reutilizable en cualquier cálculo
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
  v_days_min := COALESCE(v_days_min, 0);
  
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
  
  -- 4. Calcular ETA (Estimated Time of Arrival)
  -- ETA = HMMV + días mínimo estimado
  -- (Cuando se ordena hoy, llega en X-Y días)
  v_days_min := COALESCE(v_days_min, 0) + COALESCE(v_days_max, 0) / 2;
  
  -- 5. Retornar objeto JSON con desglose y ETA
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
-- 3. ACTUALIZAR VISTA: v_productos_con_precio_b2b
-- ============================================
-- IMPORTANTE: Esta vista ahora SOLO contiene precio_base
-- Ya NO incluye costos de logística (están separados)
-- El frontend calcula: total = precio_base + costo_logistica
-- Útil para: PDP, Catálogo, búsqueda
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
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
    p.precio_mayorista_base,
    0
  ) AS precio_b2b,
  
  -- DESGLOSE DE PRECIO (para referencia)
  ROUND((p.costo_base_excel * 0.30)::numeric, 2) AS margin_value,
  ROUND((
    (p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12
  )::numeric, 2) AS platform_fee,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Categoría
  p.categoria_id,
  c.nombre AS categoria_nombre,
  
  -- Información de envío (para logística posterior)
  p.weight_kg,
  p.width_cm,
  p.height_cm,
  p.length_cm,
  
  -- Información de mercado (default)
  m.id AS market_id,
  m.nombre AS market_name,
  
  -- Promociones
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Auditoría
  p.created_at,
  p.updated_at
FROM public.products p
LEFT JOIN public.categorias c ON p.categoria_id = c.id
LEFT JOIN public.markets m ON m.is_active = true
WHERE p.is_active = true;

-- ============================================
-- 4. VISTA: PRODUCTOS CON PRECIO BASE DETALLADO
-- ============================================
-- Alias adicional si se necesita con otro nombre
-- Nueva vista que reemplaza parte de v_productos_con_precio_b2b original
-- Contiene SOLO el precio base, sin componentes de logística
-- El frontend suma después: base_price + logistics_cost
-- Útil para: PDP, Catálogo, búsqueda
CREATE OR REPLACE VIEW public.v_productos_precio_base AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  
  -- COSTOS INTERNOS
  p.costo_base_excel AS costo_fabrica,
  p.precio_mayorista_base,
  
  -- PRECIO BASE DINÁMICO (SIN logística)
  -- Incluye: costo_fabrica + margen (30% default) + platform_fees (12%)
  -- NO depende de ruta ni logística
  COALESCE(
    public.calculate_base_price_only(p.id, 30),
    p.precio_mayorista_base,
    0
  ) AS precio_base,
  
  -- MARGEN APLICADO (para referencia)
  ROUND((p.costo_base_excel * 0.30)::numeric, 2) AS margin_value,
  
  -- FEES DE PLATAFORMA (para referencia)
  ROUND((
    (p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12
  )::numeric, 2) AS platform_fee,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Categoría
  p.categoria_id,
  c.nombre AS categoria_nombre,
  
  -- Información de envío
  p.weight_kg,
  p.width_cm,
  p.height_cm,
  p.length_cm,
  
  -- Información de mercado (default)
  m.id AS market_id,
  m.nombre AS market_name,
  
  -- Promociones
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Auditoría
  p.created_at,
  p.updated_at
FROM public.products p
LEFT JOIN public.categorias c ON p.categoria_id = c.id
LEFT JOIN public.markets m ON m.is_active = true
WHERE p.is_active = true;

-- ============================================
-- 4. VISTA: RUTAS CON INFORMACIÓN DE LOGÍSTICA
-- ============================================
-- Vista de referencia para obtener rutas disponibles
-- Útil para mostrar opciones al usuario en checkout
CREATE OR REPLACE VIEW public.v_rutas_logistica AS
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
-- 5. VISTA HELPER: CHECKOUT COMPLETO
-- ============================================
-- Vista que junta: producto + precio_base + rutas disponibles
-- Facilita cálculo en frontend
CREATE OR REPLACE VIEW public.v_checkout_summary AS
SELECT
  ppb.id AS product_id,
  ppb.sku_interno,
  ppb.nombre AS product_name,
  ppb.costo_fabrica,
  ppb.precio_base,
  ppb.margin_value,
  ppb.platform_fee,
  ppb.weight_kg,
  ppb.market_id,
  ppb.market_name,
  
  -- Rutas disponibles para este mercado (como JSON array)
  (SELECT jsonb_agg(row_to_json(r.*))
   FROM (
     SELECT 
       vrl.route_id,
       vrl.destination_country_name,
       vrl.country_code,
       vrl.transit_hub_name,
       vrl.is_direct,
       vrl.segment_a,
       vrl.segment_b
     FROM public.v_rutas_logistica vrl
     WHERE vrl.destination_country_id = (
       SELECT destination_country_id 
       FROM public.markets 
       WHERE id = ppb.market_id
       LIMIT 1
     )
   ) r
  ) AS available_routes
  
FROM public.v_productos_precio_base ppb
WHERE ppb.market_id IS NOT NULL;

-- ============================================
-- 6. COMENTARIO: INSTRUCCIONES PARA FRONTEND
-- ============================================
-- El frontend ahora:
-- 1. Consulta v_productos_precio_base → obtiene precio_base
-- 2. El usuario selecciona ruta en checkout
-- 3. Llama calculate_route_cost(route_id, weight_kg) → obtiene logistics_cost
-- 4. TOTAL = precio_base + logistics_cost
--
-- VENTAJAS:
-- - Componentes separados y testeable
-- - Frontend controla la composición
-- - Fácil cambiar lógica de cálculo
-- - Ambos motors son independientes
-- ============================================

COMMIT;
