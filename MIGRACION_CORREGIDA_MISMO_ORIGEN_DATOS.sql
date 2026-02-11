-- =============================================================================
-- ACTUALIZACIÓN FINAL: FUNCIONES DE CÁLCULO CON DATOS DE MISMO ORIGEN
-- Fecha: 2026-02-11
-- Propósito: Asegurar que TODOS los datos nuevos/antiguos vienen de TABLE products
--            NO de v_logistics_data. Listo para eliminar la vista después.
-- =============================================================================

-- ============================================================================
-- PARTE 0: LIMPIAR DEPENDENCIAS
-- ============================================================================

-- Eliminar vistas que dependen de las funciones
DROP VIEW IF EXISTS v_business_panel_with_shipping_functions CASCADE;
DROP VIEW IF EXISTS v_category_logistics CASCADE;
DROP VIEW IF EXISTS v_business_panel_cart_summary CASCADE;

-- Eliminar funciones antiguas (para recriarlas)
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric, uuid) CASCADE;

-- ============================================================================
-- PARTE 1: FUNCIÓN ACTUALIZADA - calculate_shipping_cost
-- ============================================================================

-- Función 1: Calcular costo de envío para producto individual
-- ORIGEN DE DATOS:
--   - p_weight_kg: Viene de products.weight_kg (o peso_kg, weight_g, peso_g)
--   - p_is_oversize: Viene de products.is_oversize
--   - p_length_cm, p_width_cm, p_height_cm: Vienen de products.length_cm/width_cm/height_cm
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost(
  p_route_id UUID,
  p_weight_kg NUMERIC,
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  weight_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  total_cost NUMERIC,
  volume_m3 NUMERIC
) AS $$
DECLARE
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_base_cost NUMERIC;
  v_oversize_surcharge NUMERIC := 0;
  v_dimensional_surcharge NUMERIC := 0;
  v_volume_m3 NUMERIC := 0;
  v_total_cost NUMERIC;
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

  -- Calcular costo base: (weight × tramo_a) + (weight × 2.20462 × tramo_b)
  v_base_cost := (p_weight_kg * v_tramo_a_cost) + (p_weight_kg * 2.20462 * v_tramo_b_cost);

  -- ============================================================================
  -- SURCHARGES POR OVERSIZE Y DIMENSIONES (datos vienen de products table)
  -- ============================================================================

  -- 1. Aplicar surcharge si es oversize (+15% del costo base)
  -- Origen: products.is_oversize
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- 2. Calcular surcharge por volumen si las dimensiones están disponibles
  -- Origen: products.length_cm, products.width_cm, products.height_cm
  IF p_length_cm IS NOT NULL 
     AND p_width_cm IS NOT NULL 
     AND p_height_cm IS NOT NULL THEN
    
    -- Calcular volumen en metros cúbicos
    v_volume_m3 := ROUND((p_length_cm * p_width_cm * p_height_cm / 1000000.0)::NUMERIC, 6);
    
    -- Aplicar surcharge si volumen > 0.15 m³ (+10% del costo base)
    IF v_volume_m3 > 0.15 THEN
      v_dimensional_surcharge := ROUND((v_base_cost * 0.10)::NUMERIC, 2);
    END IF;
  END IF;

  -- Calcular costo total
  v_total_cost := ROUND((v_base_cost + v_oversize_surcharge + v_dimensional_surcharge)::NUMERIC, 2);

  RETURN QUERY SELECT 
    p_weight_kg,
    ROUND(v_base_cost::NUMERIC, 2),
    v_oversize_surcharge,
    v_dimensional_surcharge,
    v_total_cost,
    v_volume_m3;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost IS 
  'Calcula costo de envío para un producto individual con surcharges por oversize y dimensiones. DATOS VIENEN DE: products table (weight_kg, is_oversize, length_cm, width_cm, height_cm)';

---

-- ============================================================================
-- PARTE 2: FUNCIÓN ACTUALIZADA - calculate_shipping_cost_cart
-- ============================================================================

-- Función 2: Calcular costo de envío para carrito
-- ORIGEN DE DATOS: (igual que calculate_shipping_cost, pero para totales de carrito)
--   - p_total_weight_kg: Suma de (products.weight_kg × cantidad)
--   - p_is_oversize: products.is_oversize
--   - p_length_cm, p_width_cm, p_height_cm: products.length_cm/width_cm/height_cm
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID DEFAULT NULL,
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  volume_m3 NUMERIC
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
  v_oversize_surcharge NUMERIC := 0;
  v_dimensional_surcharge NUMERIC := 0;
  v_volume_m3 NUMERIC := 0;
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

  -- ============================================================================
  -- SURCHARGES POR OVERSIZE Y DIMENSIONES (datos vienen de products table)
  -- ============================================================================

  -- 1. Aplicar surcharge si es oversize (+15% del costo base)
  -- Origen: products.is_oversize
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- 2. Calcular surcharge por volumen si las dimensiones están disponibles
  -- Origen: products.length_cm, products.width_cm, products.height_cm
  IF p_length_cm IS NOT NULL 
     AND p_width_cm IS NOT NULL 
     AND p_height_cm IS NOT NULL THEN
    
    -- Calcular volumen en metros cúbicos
    v_volume_m3 := ROUND((p_length_cm * p_width_cm * p_height_cm / 1000000.0)::NUMERIC, 6);
    
    -- Aplicar surcharge si volumen > 0.15 m³ (+10% del costo base)
    IF v_volume_m3 > 0.15 THEN
      v_dimensional_surcharge := ROUND((v_base_cost * 0.10)::NUMERIC, 2);
    END IF;
  END IF;

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
    v_oversize_surcharge,
    v_dimensional_surcharge,
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost + v_oversize_surcharge + v_dimensional_surcharge)::NUMERIC, 2),
    v_type_name,
    v_type_display,
    v_volume_m3;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito con peso redondeado, surcharges del tipo de envío, y surcharges por oversize/dimensiones. DATOS VIENEN DE: products table (weight_kg, is_oversize, length_cm, width_cm, height_cm)';

---

-- ============================================================================
-- PARTE 3: VISTAS ACTUALIZADAS - SIN DEPENDENCIA DE v_logistics_data
-- ============================================================================

-- Vista 1: Panel de negocio
-- CAMBIO: Consulta SOLO products (NO v_logistics_data), obtiene TODOS los datos de una fuente
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

SELECT
  vp.id as product_id,
  NULL::uuid as variant_id,
  vp.nombre as item_name,
  vp.sku_interno as sku,
  'product' as item_type,
  vp.precio_b2b as cost_per_unit,
  -- ✅ PESO: Directamente de products (mismo origen que es_oversize + dimensiones)
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    -- ✅ is_oversize: Directamente de products
    COALESCE(p.is_oversize, FALSE),
    -- ✅ Dimensiones: Directamente de products
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as shipping_cost_per_unit,
  
  vp.is_active,
  NOW() as last_updated
  
FROM v_productos_con_precio_b2b vp
-- ✅ CAMBIO: Consulta SOLO products, NO v_logistics_data
LEFT JOIN public.products p ON vp.id = p.id
WHERE vp.is_active = TRUE

UNION ALL

SELECT
  vv.product_id,
  vv.id as variant_id,
  vv.name as item_name,
  vv.sku as sku,
  'variant' as item_type,
  vv.precio_b2b_final as cost_per_unit,
  -- ✅ PESO: Del producto padre (variantes heredan dimensiones de producto)
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    -- ✅ is_oversize: Del producto padre
    COALESCE(p.is_oversize, FALSE),
    -- ✅ Dimensiones: Del producto padre
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as shipping_cost_per_unit,
  
  vv.is_active,
  NOW() as last_updated

FROM v_variantes_con_precio_b2b vv
-- ✅ CAMBIO: Consulta SOLO products (producto padre), NO v_logistics_data
LEFT JOIN public.products p ON vv.product_id = p.id
WHERE vv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_with_shipping_functions IS 
  'Business panel with shipping costs including oversize and dimensional surcharges. DATOS VIENEN DE: products table (weight, is_oversize, dimensions). NO depende de v_logistics_data.';

---

-- Vista 2: Categoría logistics
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

SELECT
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  'product' as item_type,
  -- ✅ TODOS los datos vienen directamente de products
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as shipping_cost,
  
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
  -- ✅ Variante hereda datos del producto padre (products)
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
  (SELECT base_cost FROM public.calculate_shipping_cost(
    (SELECT route_id FROM default_route_id LIMIT 1),
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0),
    COALESCE(p.is_oversize, FALSE),
    p.length_cm,
    p.width_cm,
    p.height_cm
  )) as shipping_cost,
  
  pv.is_active,
  NOW() as last_updated

FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_category_logistics IS 
  'Category logistics data with shipping costs including dimensional surcharges. DATOS VIENEN DE: products table. NO depende de v_logistics_data.';

---

-- Vista 3: Resumen carrito
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
  -- ✅ TODOS los datos de products
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
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
  -- ✅ Variante hereda de producto padre
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  
  (SELECT route_id FROM default_route_id LIMIT 1) as route_id,
  pv.is_active,
  NOW() as last_updated

FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE;

COMMENT ON VIEW v_business_panel_cart_summary IS 
  'Cart summary with dimensional data for shipping calculations. DATOS VIENEN DE: products table. NO depende de v_logistics_data.';

---

-- ============================================================================
-- PARTE 4: DOCUMENTACIÓN - ORIGEN DE DATOS PARA HOOKS REACT
-- ============================================================================

/*
DESPUÉS DE ELIMINAR v_logistics_data:

Los hooks React consultarán DIRECTAMENTE la tabla `products`:

OPCIÓN A: Consulta simple (para productos individuales)
  SELECT 
    id as product_id,
    weight_kg, peso_kg, weight_g, peso_g,  -- Peso (prioridad: weight_kg > peso_kg > weight_g > peso_g)
    is_oversize,                           -- Flag oversize
    length_cm, width_cm, height_cm        -- Dimensiones
  FROM products
  WHERE id = {product_id} AND is_active = TRUE;

OPCIÓN B: Query múltiple (para carrito con múltiples items)
  SELECT 
    p.id as product_id,
    NULL::uuid as variant_id,
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0) as weight_kg,
    p.is_oversize,
    p.length_cm, p.width_cm, p.height_cm
  FROM products p
  WHERE p.id = ANY({product_ids}) AND p.is_active = TRUE
  
  UNION ALL
  
  SELECT 
    pv.product_id,
    pv.id as variant_id,
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0) as weight_kg,
    p.is_oversize,
    p.length_cm, p.width_cm, p.height_cm
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE pv.id = ANY({variant_ids}) AND pv.is_active = TRUE;

CÓMO PASAR LOS DATOS A LAS FUNCIONES RPC:

  const { data } = await supabase.rpc('calculate_shipping_cost_cart', {
    route_id: routeId,
    total_weight_kg: totalWeightKg,
    shipping_type_id: shippingTypeId,
    
    // ✅ Datos obtenidos directamente de products (NO de v_logistics_data)
    is_oversize: productsData[0]?.is_oversize || false,
    length_cm: productsData[0]?.length_cm,
    width_cm: productsData[0]?.width_cm,
    height_cm: productsData[0]?.height_cm,
  });

VENTAJAS:
  ✅ Una sola fuente de datos: products table
  ✅ Sin dependencia de v_logistics_data
  ✅ Más eficiente (menos vistas innecesarias)
  ✅ Fácil de mantener
*/

---

-- ============================================================================
-- PARTE 5: VERIFICACIÓN
-- ============================================================================

-- Verificar que las funciones existen con nuevas firmas
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name LIKE 'calculate_shipping%'
ORDER BY routine_name;

-- Verificar que las vistas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_type = 'VIEW' 
  AND (table_name LIKE 'v_business_panel_%' 
       OR table_name = 'v_category_logistics')
ORDER BY table_name;

-- ============================================================================
-- PARTE 6: PRUEBAS DE LAS FUNCIONES (EJEMPLOS)
-- ============================================================================

/*
-- EJEMPLO 1: Producto 0.3kg, is_oversize=FALSE
SELECT * FROM public.calculate_shipping_cost(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.300,
  FALSE,
  NULL, NULL, NULL
);

-- EJEMPLO 2: Producto 0.3kg, is_oversize=TRUE
SELECT * FROM public.calculate_shipping_cost(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.300,
  TRUE,
  10, 10, 10
);

-- EJEMPLO 3: Carrito 0.6kg, EXPRESS, oversize
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.600,
  (SELECT id FROM public.shipping_type_configs WHERE type = 'EXPRESS' LIMIT 1),
  TRUE,
  20, 15, 10
);

-- EJEMPLO 4: Carrito con volumen grande (> 0.15 m³)
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.600,
  NULL,
  FALSE,
  100, 80, 30
);
*/
