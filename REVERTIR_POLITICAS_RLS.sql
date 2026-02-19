-- ============================================================================
-- REVERTIR POLÍTICAS RLS QUE BLOQUEAN CREACIÓN DE TRAMOS
-- ============================================================================

-- PASO 1: Eliminar políticas restrictivas de UPDATE
DROP POLICY IF EXISTS "Only admins can update logistics costs" ON route_logistics_costs;
DROP POLICY IF EXISTS "Only admins can update shipping tiers" ON shipping_tiers;

-- PASO 2: Deshabilitar RLS en tablas (para permitir acceso completo)
ALTER TABLE route_logistics_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_tiers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICACIÓN: Confirmar que RLS está deshabilitado
-- ============================================================================

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '🔒 RLS HABILITADO' 
    ELSE '✅ RLS DESHABILITADO (Acceso completo)' 
  END as estado
FROM pg_tables
WHERE tablename IN ('route_logistics_costs', 'shipping_tiers')
  AND schemaname = 'public';

-- ============================================================================
-- VERIFICACIÓN: Confirmar que no hay políticas restrictivas
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd as comando
FROM pg_policies
WHERE tablename IN ('route_logistics_costs', 'shipping_tiers')
ORDER BY tablename, cmd;

-- ============================================================================
-- RESULTADO:
-- ============================================================================
-- ✅ Políticas restrictivas eliminadas
-- ✅ RLS deshabilitado
-- ✅ Puedes crear/editar tramos sin restricciones
-- ⚠️  El trigger de auto-sincronización sigue activo
-- ============================================================================

SELECT '✅ POLÍTICAS RLS REVERTIDAS - Puedes crear tramos nuevamente' as status;
