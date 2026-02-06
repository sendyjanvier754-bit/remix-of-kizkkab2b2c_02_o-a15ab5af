-- ============================================================================
-- AUDITORÍA DE ESTRUCTURA DE LOGÍSTICA
-- Propósito: Revisar qué datos de peso, logística y cálculos existen en BD
-- Fecha: 2026-02-06
-- ============================================================================

-- 1. VER TODAS LAS VISTAS DISPONIBLES RELACIONADAS A LOGÍSTICA
-- ============================================================================
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname LIKE '%logistic%' 
   OR viewname LIKE '%weight%'
   OR viewname LIKE '%peso%'
   OR viewname LIKE '%envio%'
ORDER BY viewname;

-- 2. VER COLUMNAS DE PESO EN TABLAS PRINCIPALES
-- ============================================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE (column_name LIKE '%peso%' 
   OR column_name LIKE '%weight%'
   OR column_name LIKE '%kg%'
   OR column_name LIKE '%envio%'
   OR column_name LIKE '%shipping%'
   OR column_name LIKE '%logistic%')
AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 3. ESTRUCTURA DE LA TABLA PRODUCTS - CAMPOS RELEVANTES
-- ============================================================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. VER DATOS DE PESO EN PRODUCTOS (MUESTRA)
-- ============================================================================
SELECT 
  id,
  nombre,
  sku_interno,
  peso_g
FROM products
WHERE peso_g > 0 OR peso_g IS NOT NULL
LIMIT 10;

-- 5. VER ESTRUCTURA DE TABLA DE VARIANTES + PESO
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'product_variants'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. VER DATOS DE VARIANTES CON PESO (SI EXISTEN)
-- ============================================================================
SELECT 
  id,
  product_id,
  name,
  sku,
  peso_g,
  createdAt,
  updatedAt
FROM product_variants
WHERE peso_g > 0 OR peso_g IS NOT NULL
LIMIT 10;

-- 7. VER TABLA DE LOGÍSTICA/ENVÍOS (SI EXISTE)
-- ============================================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('logistics', 'shipping_rates', 'envios', 'carrier_rates', 'b2b_logistics')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 8. VER FUNCIONES RELACIONADAS A LOGÍSTICA
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%logistic%'
  OR routine_name LIKE '%shipping%'
  OR routine_name LIKE '%envio%'
  OR routine_name LIKE '%peso%'
  OR routine_name LIKE '%weight%'
  OR routine_name LIKE '%carrier%')
ORDER BY routine_name;

-- 9. VER VISTAS B2B RELACIONADAS A PRODUCTOS
-- ============================================================================
SELECT 
  schemaname,
  viewname
FROM pg_views
WHERE schemaname = 'public'
AND (viewname LIKE 'v_%' OR viewname LIKE 'vw_%')
AND (viewname LIKE '%producto%' 
  OR viewname LIKE '%product%'
  OR viewname LIKE '%variante%'
  OR viewname LIKE '%variant%'
  OR viewname LIKE '%b2b%')
ORDER BY viewname;

-- 10. VER ESTRUCTURA DE v_business_panel_data (LA VISTA QUE CREAMOS)
-- ============================================================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'v_business_panel_data'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 11. MUESTRA DE DATOS DESDE v_business_panel_data
-- ============================================================================
SELECT 
  product_id,
  variant_id,
  item_name,
  item_type,
  cost_per_unit,
  suggested_pvp_per_unit,
  margin_percentage,
  is_active
FROM v_business_panel_data
LIMIT 5;

-- 12. VER SI EXISTEN CAMPOS DE PESO EN v_productos_con_precio_b2b
-- ============================================================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'v_productos_con_precio_b2b'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 13. VER SI EXISTEN CAMPOS DE PESO EN v_variantes_con_precio_b2b
-- ============================================================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'v_variantes_con_precio_b2b'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 14. CONSULTA INTEGRADA: PRODUCTOS CON PESO Y PRECIOS B2B
-- ============================================================================
SELECT 
  vp.id,
  vp.nombre,
  vp.precio_b2b,
  vp.is_active,
  p.peso_g
FROM v_productos_con_precio_b2b vp
LEFT JOIN products p ON vp.id = p.id
WHERE p.peso_g > 0 OR p.peso_g IS NOT NULL
LIMIT 10;

-- 15. CONSULTA INTEGRADA: VARIANTES CON PESO Y PRECIOS B2B
-- ============================================================================
SELECT 
  vv.id,
  vv.name,
  vv.product_id,
  vv.precio_b2b_final,
  vv.is_active,
  pv.peso_g
FROM v_variantes_con_precio_b2b vv
LEFT JOIN product_variants pv ON vv.id = pv.id
WHERE pv.peso_g > 0 OR pv.peso_g IS NOT NULL
LIMIT 10;

-- 16. VER TABLAS DE CONFIGURACIÓN DE LOGÍSTICA
-- ============================================================================
SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'shipping_zones',
  'carrier_integrations', 
  'shipping_rates',
  'logistics_config',
  'envios_config',
  'carriers'
)
ORDER BY table_name;

-- 17. RESUMEN: CAMPOS DISPONIBLES PARA CÁLCULO DE LOGÍSTICA
-- ============================================================================
SELECT 
  'PRODUCTOS' as source,
  'peso_g' as field,
  'numeric' as type,
  COUNT(*) as count_with_data
FROM products
WHERE peso_g > 0
UNION ALL
SELECT 
  'VARIANTES',
  'peso_g',
  'numeric',
  COUNT(*)
FROM product_variants
WHERE peso_g > 0
UNION ALL
SELECT 
  'PRECIOS B2B',
  'precio_b2b',
  'numeric',
  COUNT(*)
FROM v_productos_con_precio_b2b
WHERE is_active = TRUE;

-- ============================================================================
-- RESULTADO ESPERADO: Esta auditoría mostrará:
-- 1. Qué vistas de logística existen
-- 2. Dónde se almacenan los datos de peso
-- 3. Si hay funciones para calcular costos
-- 4. Cómo están estructurados los datos para integración
-- ============================================================================
