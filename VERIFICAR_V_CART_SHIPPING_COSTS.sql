-- =============================================================================
-- VERIFICACIÓN: v_cart_shipping_costs
-- Fecha: 2026-02-12
-- Propósito: Verificar funcionamiento y datos de v_cart_shipping_costs
-- =============================================================================

-- =============================================================================
-- TEST 1: Verificar que la vista existe
-- =============================================================================
SELECT 
  table_name,
  table_schema,
  table_type
FROM information_schema.tables
WHERE table_name = 'v_cart_shipping_costs'
  AND table_schema = 'public';

-- Resultado esperado: 1 fila con table_type = 'VIEW'

-- =============================================================================
-- TEST 2: Ver estructura de columnas
-- =============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'v_cart_shipping_costs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- TEST 3: Ver datos actuales (resumen completo)
-- =============================================================================
SELECT 
  total_items as "Items en Carrito",
  total_weight_kg as "Peso Total (kg)",
  weight_rounded_kg as "Peso Redondeado (kg)",
  calculated_weight_rounded_kg as "Peso Calculado (kg)",
  base_cost as "Costo Base (HTG)",
  oversize_surcharge as "Cargo Oversize (HTG)",
  dimensional_surcharge as "Cargo Dimensional (HTG)",
  volume_m3 as "Volumen (m³)",
  extra_cost as "Costo Extra (HTG)",
  shipping_type_name as "Tipo Envío",
  total_cost_with_type as "Costo Total (HTG)",
  last_updated as "Última Actualización"
FROM v_cart_shipping_costs;

-- =============================================================================
-- TEST 4: Ver productos del carrito simulado (detalle)
-- =============================================================================
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
cart_items AS (
  SELECT 
    p.id,
    p.nombre,
    p.sku_interno,
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
    p.is_oversize,
    CONCAT(p.length_cm, 'x', p.width_cm, 'x', p.height_cm) as dimensiones_cm,
    1 as quantity
  FROM public.products p
  WHERE p.is_active = TRUE
  ORDER BY p.nombre
  LIMIT 10
)
SELECT 
  ROW_NUMBER() OVER() as "#",
  nombre as "Producto",
  sku_interno as "SKU",
  weight_kg as "Peso (kg)",
  is_oversize as "Oversize?",
  dimensiones_cm as "Dimensiones (LxWxH)",
  quantity as "Cantidad"
FROM cart_items;

-- =============================================================================
-- TEST 5: Verificar cálculo de costos paso por paso
-- =============================================================================
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
cart_items AS (
  SELECT 
    p.id,
    p.nombre,
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
    p.is_oversize,
    p.length_cm,
    p.width_cm,
    p.height_cm,
    1 as quantity
  FROM public.products p
  WHERE p.is_active = TRUE
  ORDER BY p.nombre
  LIMIT 10
),
cart_totals AS (
  SELECT 
    COUNT(*) as total_items,
    SUM(weight_kg * quantity) as total_weight_kg,
    CEIL(SUM(weight_kg * quantity)) as weight_rounded_kg,
    BOOL_OR(is_oversize) as has_oversize,
    MAX(length_cm) as max_length_cm,
    MAX(width_cm) as max_width_cm,
    MAX(height_cm) as max_height_cm
  FROM cart_items
)
SELECT 
  'Paso a Paso' as "Etapa",
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 3) as "Peso Total (kg)",
  weight_rounded_kg as "Peso Redondeado (kg)",
  has_oversize as "¿Tiene Oversize?",
  max_length_cm as "Max Largo (cm)",
  max_width_cm as "Max Ancho (cm)",
  max_height_cm as "Max Alto (cm)"
FROM cart_totals;

-- =============================================================================
-- TEST 6: Comparar total_cost de la vista vs datos del carrito
-- =============================================================================
SELECT 
  'Vista v_cart_shipping_costs' as "Fuente",
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 2) as "Peso (kg)",
  base_cost as "Base",
  (oversize_surcharge + dimensional_surcharge + extra_cost) as "Extras",
  total_cost_with_type as "Total (HTG)"
FROM v_cart_shipping_costs;

-- =============================================================================
-- TEST 7: Verificar errores potenciales
-- =============================================================================

-- ¿Hay productos sin peso?
SELECT 
  COUNT(*) as "Productos Sin Peso"
FROM public.products p
WHERE p.is_active = TRUE
  AND COALESCE(p.weight_kg, p.peso_kg, p.weight_g, p.peso_g) IS NULL
  AND p.id IN (
    SELECT id FROM public.products 
    WHERE is_active = TRUE 
    ORDER BY nombre 
    LIMIT 10
  );

-- ¿La ruta está configurada correctamente?
SELECT 
  sr.id,
  th.code as "Hub Origen",
  dc.code as "País Destino",
  sr.is_active as "Activa?"
FROM public.shipping_routes sr
JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT';

-- ¿El tipo de envío STANDARD existe?
SELECT 
  id,
  type,
  is_active
FROM public.shipping_type_configs
WHERE type = 'STANDARD';

-- =============================================================================
-- TEST 8: Resumen final (pantalla de dashboard)
-- =============================================================================
SELECT 
  '🛒 CARRITO' as "CARRITO",
  total_items || ' productos' as "INFO",
  ROUND(total_weight_kg::numeric, 2) || ' kg' as "PESO",
  '---' as "SEPARADOR",
  '📦 ENVÍO' as "ENVIO",
  shipping_type_display as "TIPO",
  base_cost || ' HTG' as "BASE",
  (oversize_surcharge + dimensional_surcharge + extra_cost) || ' HTG' as "EXTRAS",
  total_cost_with_type || ' HTG' as "TOTAL"
FROM v_cart_shipping_costs;

-- =============================================================================
-- RESULTADO ESPERADO:
-- - Vista debe existir y tener 15 columnas
-- - Debe retornar 1 fila con datos de carrito simulado (10 productos)
-- - Costos deben ser números positivos
-- - shipping_type_name debe ser 'STANDARD' o similar
-- - total_cost_with_type debe ser > 0
-- =============================================================================

SELECT '✅ Verificación de v_cart_shipping_costs completada' as status;
