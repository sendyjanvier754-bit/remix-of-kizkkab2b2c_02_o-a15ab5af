-- ============================================================================
-- 🔍 VERIFICAR SI LAS VISTAS EXISTEN EN SUPABASE
-- ============================================================================

-- PASO 1: Ver TODAS las vistas en el schema public
SELECT 
  '📊 VISTAS EXISTENTES' AS tipo,
  table_name AS nombre_vista,
  CASE 
    WHEN table_name LIKE '%precio%' THEN '💰 PRECIO'
    WHEN table_name LIKE '%logistic%' OR table_name LIKE '%shipping%' THEN '🚚 LOGÍSTICA'
    WHEN table_name LIKE '%cart%' THEN '🛒 CARRITO'
    WHEN table_name LIKE '%order%' THEN '📦 PEDIDOS'
    ELSE '📋 OTRA'
  END AS categoria
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- PASO 2: Verificar específicamente las vistas críticas para "Mis Compras"
-- ============================================================================

SELECT 
  '🎯 VISTAS CRÍTICAS' AS tipo,
  vista_nombre,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = 'public' AND table_name = vista_nombre
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END AS estado
FROM (
  VALUES 
    ('v_productos_con_precio_b2b'),
    ('v_variantes_con_precio_b2b'),
    ('v_cart_items_with_details'),
    ('v_b2c_max_orders'),
    ('v_logistics_data')
) AS vistas(vista_nombre);

-- ============================================================================
-- PASO 3: Ver permisos GRANT de las vistas (si existen)
-- ============================================================================

SELECT 
  '🔐 PERMISOS' AS tipo,
  table_name AS vista,
  grantee AS usuario,
  privilege_type AS permiso
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'v_productos_con_precio_b2b',
    'v_variantes_con_precio_b2b',
    'v_cart_items_with_details',
    'v_b2c_max_orders',
    'v_logistics_data'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- PASO 4: Ver definición de v_productos_con_precio_b2b (si existe)
-- ============================================================================

SELECT 
  '📝 DEFINICIÓN' AS tipo,
  pg_get_viewdef('public.v_productos_con_precio_b2b'::regclass, true) AS definicion;

-- ============================================================================
-- PASO 5: Ver tablas que SÍ existen relacionadas con pedidos
-- ============================================================================

SELECT 
  '📋 TABLAS PEDIDOS' AS tipo,
  table_name AS nombre_tabla,
  CASE 
    WHEN table_name LIKE '%order%' THEN '📦 PEDIDOS'
    WHEN table_name LIKE '%cart%' THEN '🛒 CARRITO'
    ELSE '📋 OTRA'
  END AS categoria
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (table_name LIKE '%order%' OR table_name LIKE '%cart%')
ORDER BY table_name;

-- ============================================================================
-- 📋 INSTRUCCIONES
-- ============================================================================
/*
EJECUTA ESTO EN SUPABASE SQL EDITOR

INTERPRETACIÓN:

PASO 1: Lista todas las vistas
  → Si la lista está vacía o falta alguna vista → Necesitas CREARLAS

PASO 2: Estado de vistas críticas
  → ✅ EXISTE: La vista está disponible
  → ❌ NO EXISTE: Necesitas ejecutar el script de creación

PASO 3: Permisos
  → Debe mostrar SELECT para 'anon' y 'authenticated'
  → Si no aparece → Necesitas ejecutar GRANT

PASO 4: Definición de la vista
  → Muestra el SQL que define la vista
  → Si da error "does not exist" → La vista NO existe

PASO 5: Tablas base
  → Verifica que orders_b2b, order_items_b2b, b2b_carts existan
  → Si NO existen → Problema grave de migración

============================================================================
🎯 PRÓXIMA ACCIÓN SEGÚN RESULTADO
============================================================================

CASO A: Las vistas NO EXISTEN (PASO 2 muestra ❌)
  → Ejecutar: FIX_PRECIO_B2B_MARGIN_DINAMICO.sql
  → Esto creará v_productos_con_precio_b2b y v_variantes_con_precio_b2b

CASO B: Las vistas EXISTEN pero sin permisos (PASO 3 vacío)
  → Ejecutar:
    GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
    GRANT SELECT ON public.v_variantes_con_precio_b2b TO anon, authenticated;

CASO C: Las tablas base NO EXISTEN (PASO 5 muestra vacío)
  → Problema crítico: necesitas ejecutar migraciones completas
  → Ejecutar: DATABASE_SCHEMA_MIGRATION.sql (si existe)

CASO D: Todo existe pero los queries fallan
  → Problema de RLS en las tablas base
  → Ejecutar: FIX_ORDERS_RLS_COMPLETE.sql

============================================================================
*/
