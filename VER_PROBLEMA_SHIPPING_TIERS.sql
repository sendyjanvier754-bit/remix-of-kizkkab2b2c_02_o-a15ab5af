-- ============================================================================
-- ⚠️ VERIFICAR PROBLEMA EN SHIPPING_TIERS
-- ============================================================================

-- 1. Ver qué columna existe actualmente
SELECT 
  '1️⃣ COLUMNAS EN SHIPPING_TIERS' as seccion,
  column_name as columna,
  data_type as tipo,
  CASE 
    WHEN column_name = 'route_id' THEN '✅ CORRECTO (frontend espera esto)'
    WHEN column_name = 'shipping_route_id' THEN '⚠️ INCORRECTO (frontend espera route_id)'
    ELSE ''
  END as estado
FROM information_schema.columns
WHERE table_name = 'shipping_tiers' 
  AND table_schema = 'public'
  AND column_name IN ('route_id', 'shipping_route_id')
ORDER BY column_name;

-- 2. Diagnóstico automático
SELECT 
  '2️⃣ DIAGNÓSTICO AUTOMÁTICO' as seccion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'route_id'
    ) THEN '✅ Tabla está CORRECTA - Usa route_id'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN '⚠️ Tabla necesita FIX - Usa shipping_route_id pero frontend espera route_id'
    ELSE '❌ ERROR - No tiene columna FK de ruta'
  END as diagnostico,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_tiers' 
        AND column_name = 'shipping_route_id'
    ) THEN 'Ejecutar: FIX_SHIPPING_TIERS_AHORA.sql'
    ELSE 'No requiere acción'
  END as accion_requerida;

-- 3. Ver datos actuales en shipping_tiers (sin importar el nombre de la columna)
SELECT 
  '3️⃣ DATOS EN SHIPPING_TIERS' as seccion,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE is_active = true) as activos,
  COUNT(*) FILTER (WHERE tier_type = 'standard') as tipo_standard,
  COUNT(*) FILTER (WHERE tier_type = 'express') as tipo_express
FROM shipping_tiers;
