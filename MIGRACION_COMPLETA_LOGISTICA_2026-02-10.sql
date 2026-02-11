-- =============================================================================
-- MIGRACIÓN COMPLETA: NUEVA LÓGICA DE LOGÍSTICA CON TIPOS DE ENVÍO
-- Fecha: 2026-02-10
-- Descripción: Funciones, vistas y tipos de envío para panel negocio + carrito
-- =============================================================================

-- ============================================================================
-- PARTE 0: LIMPIAR DEPENDENCIAS (VISTAS ANTIGUAS PRIMERO)
-- ============================================================================

-- Eliminar vistas que dependen de las funciones
DROP VIEW IF EXISTS v_business_panel_with_shipping_functions CASCADE;
DROP VIEW IF EXISTS v_category_logistics CASCADE;
DROP VIEW IF EXISTS v_business_panel_cart_summary CASCADE;

-- Eliminar funciones antiguas si existen (todos los tipos de parámetros posibles)
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric, uuid) CASCADE;

-- ============================================================================
-- PARTE 1: CREAR FUNCIONES SQL PARA CÁLCULO DE ENVÍO
-- ============================================================================

-- Función 1: Calcular costo de envío para producto individual (peso real, sin redondeo)
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost(
  p_route_id UUID,
  p_weight_kg NUMERIC
)
RETURNS TABLE (
  weight_kg NUMERIC,
  base_cost NUMERIC
) AS $$
DECLARE
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_base_cost NUMERIC;
BEGIN
  -- Obtener costos del tramo A (china_to_transit)
  SELECT cost_per_kg INTO v_tramo_a_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'china_to_transit'
  LIMIT 1;

  -- Obtener costos del tramo B (transit_to_destination)
  SELECT cost_per_kg INTO v_tramo_b_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'transit_to_destination'
  LIMIT 1;

  -- Si no existen costos, usar valores por defecto (China → Haití)
  v_tramo_a_cost := COALESCE(v_tramo_a_cost, 3.50);
  v_tramo_b_cost := COALESCE(v_tramo_b_cost, 5.00);

  -- Calcular: (weight × tramo_a) + (weight × 2.20462 × tramo_b)
  v_base_cost := (p_weight_kg * v_tramo_a_cost) + (p_weight_kg * 2.20462 * v_tramo_b_cost);

  RETURN QUERY SELECT 
    p_weight_kg,
    ROUND(v_base_cost::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost IS 
  'Calcula costo de envío para un producto individual usando peso real (sin redondear)';

---

-- Función 2: Calcular costo de envío para carrito (redondea peso, aplica surcharge)
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID DEFAULT NULL
)
RETURNS TABLE (
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR
) AS $$
DECLARE
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_base_cost NUMERIC;
  v_extra_cost_fixed NUMERIC;
  v_extra_cost_percent NUMERIC;
  v_extra_cost NUMERIC := 0;
  v_total_extra NUMERIC := 0;
  v_type_name VARCHAR;
  v_type_display VARCHAR;
  v_weight_rounded NUMERIC;
BEGIN
  -- Redondear peso a superior (CEIL)
  v_weight_rounded := CEIL(p_total_weight_kg);

  -- Obtener costos del tramo A
  SELECT cost_per_kg INTO v_tramo_a_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'china_to_transit'
  LIMIT 1;

  -- Obtener costos del tramo B
  SELECT cost_per_kg INTO v_tramo_b_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'transit_to_destination'
  LIMIT 1;

  -- Usar valores por defecto si no existen
  v_tramo_a_cost := COALESCE(v_tramo_a_cost, 3.50);
  v_tramo_b_cost := COALESCE(v_tramo_b_cost, 5.00);

  -- Calcular costo base con peso redondeado
  v_base_cost := (v_weight_rounded * v_tramo_a_cost) + (v_weight_rounded * 2.20462 * v_tramo_b_cost);

  -- Si se proporciona tipo de envío, obtener surcharges
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

    -- Calcular extra cost: cargo fijo + porcentaje del costo base
    v_total_extra := COALESCE(v_extra_cost_fixed, 0) + 
                     (v_base_cost * COALESCE(v_extra_cost_percent, 0) / 100);
    v_extra_cost := v_total_extra;
  END IF;

  RETURN QUERY SELECT 
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost)::NUMERIC, 2),
    v_type_name,
    v_type_display;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito: redondea peso a superior, aplica surcharges del tipo de envío';

---

-- ============================================================================
-- PARTE 2: CREAR TABLA DE TIPOS DE ENVÍO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_type_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_route_id UUID NOT NULL REFERENCES public.shipping_routes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'STANDARD', 'EXPRESS', 'PRIORITY'
  display_name VARCHAR(100) NOT NULL, -- e.g., "Envío Estándar", "Envío Express"
  
  -- Cargo extra específico del tipo de envío
  extra_cost_fixed NUMERIC(10,2) DEFAULT 0, -- Cargo fijo (e.g., $2.00 para EXPRESS)
  extra_cost_percent NUMERIC(5,2) DEFAULT 0, -- Porcentaje extra (e.g., 10 para +10%)
  
  -- Metadata
  description TEXT,
  allows_oversize BOOLEAN DEFAULT true,
  allows_sensitive BOOLEAN DEFAULT true,
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint: Una ruta no puede tener dos tipos iguales
  UNIQUE(shipping_route_id, type)
);

-- Habilitar Row Level Security
ALTER TABLE public.shipping_type_configs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Shipping type configs viewable by authenticated" ON public.shipping_type_configs;
CREATE POLICY "Shipping type configs viewable by authenticated" ON public.shipping_type_configs 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage shipping type configs" ON public.shipping_type_configs;
CREATE POLICY "Admins manage shipping type configs" ON public.shipping_type_configs 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_route_id ON public.shipping_type_configs(shipping_route_id);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_type ON public.shipping_type_configs(type);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_active ON public.shipping_type_configs(is_active) WHERE is_active = true;

---

-- ============================================================================
-- PARTE 3: CREAR VISTAS PARA PANEL DE NEGOCIO
-- ============================================================================

-- Vista 1: Panel de negocio con costos calculados por función
CREATE OR REPLACE VIEW v_business_panel_with_shipping_functions AS

WITH route_config AS (
  SELECT sr.id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
  LIMIT 1
)

-- Rama 1: Productos
SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  COALESCE(ld.weight_kg, 0) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )) as shipping_cost_per_unit,
  
  (vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as suggested_pvp_per_unit,
  
  vp.precio_b2b as investment_1unit,
  (vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as revenue_1unit,
  
  ((vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) - vp.precio_b2b) as profit_1unit,
  
  CASE 
    WHEN vp.precio_b2b > 0 THEN (
      ((vp.precio_b2b * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0) - vp.precio_b2b) / vp.precio_b2b * 100
    )::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vp.is_active,
  NOW() as last_updated
  
FROM v_productos_con_precio_b2b vp
LEFT JOIN v_logistics_data ld ON vp.id = ld.product_id AND ld.variant_id IS NULL
WHERE vp.is_active = TRUE

UNION ALL

-- Rama 2: Variantes
SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.name as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  COALESCE(ld.weight_kg, 0) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )) as shipping_cost_per_unit,
  
  (vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as suggested_pvp_per_unit,
  
  vv.precio_b2b_final as investment_1unit,
  (vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) as revenue_1unit,
  
  ((vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(ld.weight_kg, 0)
  )), 0) - vv.precio_b2b_final) as profit_1unit,
  
  CASE 
    WHEN vv.precio_b2b_final > 0 THEN (
      ((vv.precio_b2b_final * 2.5) + COALESCE((SELECT base_cost FROM public.calculate_shipping_cost(
        (SELECT route_id FROM default_route_id LIMIT 1),
        COALESCE(ld.weight_kg, 0)
      )), 0) - vv.precio_b2b_final) / vv.precio_b2b_final * 100
    )::numeric(10,1)
    ELSE 0::numeric(10,1)
  END as margin_percentage,
  
  vv.is_active,
  NOW() as last_updated

FROM v_variantes_con_precio_b2b vv
LEFT JOIN v_logistics_data ld ON vv.id = ld.variant_id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_with_shipping_functions IS 
  'Business panel with shipping costs calculated using calculate_shipping_cost() function';

---

-- Vista 2: Datos de logística para módulo de categoría
CREATE OR REPLACE VIEW v_category_logistics AS

WITH route_config AS (
  SELECT sr.id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
  LIMIT 1
)

-- Rama 1: Productos
SELECT
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  'product' as item_type,
  p.peso_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, 0)
  )) as shipping_cost,
  
  p.is_active,
  NOW() as last_updated

FROM public.products p
WHERE p.is_active = TRUE

UNION ALL

-- Rama 2: Variantes
SELECT
  pv.product_id,
  pv.id as variant_id,
  p.nombre || ' - ' || pv.name as item_name,
  pv.sku as sku,
  'variant' as item_type,
  p.peso_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.peso_kg, 0)
  )) as shipping_cost,
  
  pv.is_active,
  NOW() as last_updated

FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_category_logistics IS 
  'Category logistics data with shipping costs calculated using calculate_shipping_cost()';

---

-- Vista 3: Resumen de carrito
CREATE OR REPLACE VIEW v_business_panel_cart_summary AS

WITH route_config AS (
  SELECT sr.id
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
),
default_route_id AS (
  SELECT COALESCE(id, '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid) as route_id
  FROM route_config
  UNION ALL
  SELECT '21420dcb-9d8a-4947-8530-aaf3519c9047'::uuid
  LIMIT 1
)

SELECT
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  'product' as item_type,
  p.peso_kg,
  
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  p.is_active,
  NOW() as last_updated

FROM public.products p
WHERE p.is_active = TRUE

UNION ALL

SELECT
  pv.product_id,
  pv.id as variant_id,
  p.nombre || ' - ' || pv.name as item_name,
  pv.sku as sku,
  'variant' as item_type,
  p.peso_kg,
  
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  pv.is_active,
  NOW() as last_updated

FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_cart_summary IS 
  'Cart summary data with route information for shipping calculations';

---

-- ============================================================================
-- PARTE 4: INSERTAR TIPOS DE ENVÍO INICIALES
-- ============================================================================

-- Obtener la ruta China → Haití
-- Reemplazar con tu UUID real si es diferente
INSERT INTO public.shipping_type_configs (
  shipping_route_id,
  type,
  display_name,
  extra_cost_fixed,
  extra_cost_percent,
  is_active,
  priority_order
)
VALUES 
  (
    '21420dcb-9d8a-4947-8530-aaf3519c9047',
    'STANDARD',
    'Envío Estándar',
    0,
    0,
    true,
    1
  )
ON CONFLICT (shipping_route_id, type) DO NOTHING;

INSERT INTO public.shipping_type_configs (
  shipping_route_id,
  type,
  display_name,
  extra_cost_fixed,
  extra_cost_percent,
  is_active,
  priority_order
)
VALUES 
  (
    '21420dcb-9d8a-4947-8530-aaf3519c9047',
    'EXPRESS',
    'Envío Express',
    2.00,
    0,
    true,
    2
  )
ON CONFLICT (shipping_route_id, type) DO NOTHING;

INSERT INTO public.shipping_type_configs (
  shipping_route_id,
  type,
  display_name,
  extra_cost_fixed,
  extra_cost_percent,
  is_active,
  priority_order
)
VALUES 
  (
    '21420dcb-9d8a-4947-8530-aaf3519c9047',
    'PRIORITY',
    'Envío Priority',
    0,
    10,
    true,
    3
  )
ON CONFLICT (shipping_route_id, type) DO NOTHING;

---

-- ============================================================================
-- PARTE 5: VERIFICACIÓN (Ejecutar estas queries para validar)
-- ============================================================================

-- Verificar que las funciones existen
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'calculate_shipping%'
ORDER BY routine_name;

-- Verificar que la tabla existe
SELECT COUNT(*) as total_tipos
FROM public.shipping_type_configs
WHERE is_active = TRUE;

-- Verificar que las vistas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_type = 'VIEW' 
  AND (table_name LIKE 'v_business_panel_%' 
       OR table_name = 'v_category_logistics')
ORDER BY table_name;

-- Probar calculate_shipping_cost (0.400 kg debe dar ~$14.52 si es para carrito después del CEIL)
SELECT * FROM public.calculate_shipping_cost(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.400
);

-- Probar calculate_shipping_cost_cart (0.700 kg sin tipo)
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.700,
  NULL
);

