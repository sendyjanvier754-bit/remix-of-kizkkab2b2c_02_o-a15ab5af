-- ============================================================================
-- ELIMINAR FUNCIONES Y TABLA DEPRECADAS DE SHIPPING
-- ============================================================================
-- 
-- CONTEXTO:
-- - Frontend usa v_cart_shipping_costs (vista) y get_user_cart_shipping_cost (segura)
-- - Las funciones calculate_cart_shipping_cost_dynamic y get_cart_shipping_cost 
--   NO se usan actualmente en el frontend
-- - La tabla shipping_type_configs fue reemplazada por shipping_tiers
-- 
-- ESTE SCRIPT ELIMINA:
-- ✅ calculate_cart_shipping_cost_dynamic (todas las versiones)
-- ✅ get_cart_shipping_cost (todas las versiones)
-- ✅ shipping_type_configs (tabla antigua)
-- 
-- RAZONES:
-- - No se usan en el código actual
-- - Ya migramos a shipping_tiers
-- - Frontend usa get_user_cart_shipping_cost (100% segura desde DB)
-- ============================================================================

-- PASO 1: Verificar que no hay dependencias críticas
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 VERIFICANDO DEPENDENCIAS ANTES DE ELIMINAR...';
  RAISE NOTICE '';
END $$;

-- Ver si hay vistas que dependan de estas funciones
SELECT 
  '⚠️ VISTAS QUE DEPENDEN DE FUNCIONES A ELIMINAR' as verificacion,
  dependent_view.relname as vista_dependiente,
  source_table.relname as depende_de
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
WHERE source_table.relname IN ('calculate_cart_shipping_cost_dynamic', 'get_cart_shipping_cost')
  AND dependent_view.relkind = 'v';

-- Verificar foreign keys hacia shipping_type_configs
SELECT 
  '🔗 FOREIGN KEYS HACIA shipping_type_configs' as verificacion,
  tc.table_name as tabla_que_referencia,
  kcu.column_name as columna_fk
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'shipping_type_configs';

-- ============================================================================
-- PASO 2: DROP FUNCIONES
-- ============================================================================

-- Eliminar calculate_cart_shipping_cost_dynamic (todas las versiones)
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(JSONB, UUID) CASCADE;

-- Eliminar get_cart_shipping_cost (todas las versiones)
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(JSONB, UUID) CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Funciones eliminadas:';
  RAISE NOTICE '   - calculate_cart_shipping_cost_dynamic';
  RAISE NOTICE '   - get_cart_shipping_cost';
END $$;

-- ============================================================================
-- PASO 3: DROP TABLA shipping_type_configs
-- ============================================================================

-- Eliminar tabla antigua
DROP TABLE IF EXISTS public.shipping_type_configs CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Tabla eliminada:';
  RAISE NOTICE '   - shipping_type_configs';
END $$;

-- ============================================================================
-- PASO 4: VERIFICAR ELIMINACIÓN
-- ============================================================================

-- Verificar que funciones ya no existen
SELECT 
  '🔍 VERIFICAR: Funciones eliminadas' as verificacion,
  COUNT(*) as funciones_restantes
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('calculate_cart_shipping_cost_dynamic', 'get_cart_shipping_cost');

-- Verificar que tabla ya no existe
SELECT 
  '🔍 VERIFICAR: Tabla eliminada' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'shipping_type_configs'
    ) THEN '❌ La tabla AÚN EXISTE'
    ELSE '✅ Tabla eliminada correctamente'
  END as estado;

-- ============================================================================
-- PASO 5: VERIFICAR QUE NO HAY REFERENCIAS A shipping_type_configs
-- ============================================================================

-- Buscar referencias en funciones restantes
SELECT 
  '⚠️ FUNCIONES CON REFERENCIAS A shipping_type_configs' as advertencia,
  routine_name as funcion,
  routine_type as tipo
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%shipping_type_configs%'
ORDER BY routine_name;

-- Buscar referencias en vistas
SELECT 
  '⚠️ VISTAS CON REFERENCIAS A shipping_type_configs' as advertencia,
  table_name as vista
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%shipping_type_configs%'
ORDER BY table_name;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

SELECT 
  '🎉 LIMPIEZA COMPLETADA' as titulo,
  'Funciones y tabla deprecadas eliminadas exitosamente' as mensaje,
  '
  ELIMINADO:
  ❌ calculate_cart_shipping_cost_dynamic (JSONB)
  ❌ calculate_cart_shipping_cost_dynamic (JSONB, UUID)
  ❌ get_cart_shipping_cost (JSONB)
  ❌ get_cart_shipping_cost (JSONB, UUID)
  ❌ shipping_type_configs (tabla)
  
  EN USO (NO ELIMINADAS):
  ✅ get_user_cart_shipping_cost - Cálculo seguro desde DB
  ✅ calculate_shipping_cost_cart - Motor de cálculo
  ✅ calculate_shipping_cost_for_selected_items - Items seleccionados
  ✅ shipping_tiers - Tabla nueva de configuración
  ✅ v_cart_shipping_costs - Vista dinámica para frontend
  
  PRÓXIMOS PASOS:
  1. Regenerar tipos TypeScript: npx supabase gen types typescript
  2. Verificar que frontend sigue funcionando
  3. Deploy a producción cuando esté listo
  ' as detalles;
