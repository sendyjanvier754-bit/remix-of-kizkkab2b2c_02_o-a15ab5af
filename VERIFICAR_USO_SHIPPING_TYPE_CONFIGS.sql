-- =============================================================================
-- VERIFICAR DÓNDE SE USA shipping_type_configs
-- =============================================================================

-- 1. ¿Existe la tabla?
SELECT 
  '🔍 VERIFICANDO TABLA shipping_type_configs' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'shipping_type_configs'
    ) THEN '✅ La tabla EXISTE'
    ELSE '❌ La tabla NO EXISTE'
  END as estado;

-- 2. Si existe, ¿tiene datos?
SELECT 
  '📊 DATOS EN shipping_type_configs' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_type_configs')
    THEN (SELECT COUNT(*)::TEXT || ' registros' FROM shipping_type_configs)
    ELSE 'Tabla no existe'
  END as cantidad;

-- 3. ¿Qué columnas tiene?
SELECT 
  '📋 COLUMNAS DE shipping_type_configs' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'shipping_type_configs'
ORDER BY ordinal_position;

-- 4. ¿Hay funciones que la usen?
SELECT 
  '⚙️ FUNCIONES QUE USAN shipping_type_configs' as info,
  routine_name as funcion,
  routine_type as tipo
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%shipping_type_configs%'
ORDER BY routine_name;

-- 5. ¿Hay vistas que la usen?
SELECT 
  '👁️ VISTAS QUE USAN shipping_type_configs' as info,
  table_name as vista
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%shipping_type_configs%'
ORDER BY table_name;

-- 6. ¿Hay foreign keys hacia shipping_type_configs?
SELECT 
  '🔗 TABLAS QUE REFERENCIAN shipping_type_configs' as info,
  tc.table_name as tabla_que_referencia,
  kcu.column_name as columna_fk,
  ccu.table_name as tabla_referenciada,
  ccu.column_name as columna_referenciada
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'shipping_type_configs';

-- =============================================================================
-- COMPARACIÓN: shipping_type_configs vs shipping_tiers
-- =============================================================================

SELECT 
  '🆚 COMPARACIÓN: Tabla antigua vs nueva' as comparacion,
  (SELECT COUNT(*) FROM shipping_type_configs) as registros_en_shipping_type_configs,
  (SELECT COUNT(*) FROM shipping_tiers) as registros_en_shipping_tiers,
  CASE 
    WHEN (SELECT COUNT(*) FROM shipping_type_configs) > 0 
    THEN '⚠️ shipping_type_configs tiene datos - considerar migración'
    ELSE '✅ shipping_type_configs está vacía - seguro deprecar'
  END as recomendacion;

-- =============================================================================
-- RECOMENDACIÓN
-- =============================================================================

SELECT 
  '💡 RECOMENDACIÓN FINAL' as titulo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_definition ILIKE '%shipping_type_configs%')
    THEN '⚠️ HAY FUNCIONES USANDO shipping_type_configs - Actualizar primero'
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE view_definition ILIKE '%shipping_type_configs%')
    THEN '⚠️ HAY VISTAS USANDO shipping_type_configs - Actualizar primero'
    WHEN (SELECT COUNT(*) FROM shipping_type_configs) > 0
    THEN '⚠️ TIENE DATOS - Migrar a shipping_tiers antes de deprecar'
    ELSE '✅ SEGURO DEPRECAR - No se usa en ningún lugar'
  END as recomendacion;
