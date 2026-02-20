-- =============================================================================
-- 🎟️ TICKET #02B: ESTRUCTURA DETALLADA (PASO POR PASO)
-- =============================================================================
-- Ejecuta SOLO LOS PRIMEROS 2 PASOS (estructura de ADDRESSES)
-- ESTADO: Listo para ejecutar
-- Tiempo estimado: 30 segundos
-- =============================================================================

-- ✅ PASO 1: Estructura de ADDRESSES (columnas y tipos)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'addresses' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ✅ PASO 2: Ver 5 registros de ADDRESSES (datos reales)
SELECT 
  id,
  user_id,
  label,
  full_name,
  country,
  city,
  street_address,
  is_default,
  created_at
FROM public.addresses
LIMIT 5;

-- =============================================================================
-- CONFIRMACIÓN: ¿Qué ves?
-- =============================================================================
-- 1. ¿ADDRESSES tiene columna destination_country_id? (SÍ / NO)
-- 2. ¿Qué columnas tiene ADDRESSES? (listar)
-- 3. ¿El valor de country es "Haiti"? (SÍ / NO)
-- =============================================================================
