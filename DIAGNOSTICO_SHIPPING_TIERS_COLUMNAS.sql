-- =============================================================================
-- 🔍 DIAGNÓSTICO: COLUMNAS EXACTAS DE shipping_tiers EN PRODUCCIÓN
-- =============================================================================
-- Ejecuta esto en Supabase SQL Editor y pega el resultado completo
-- =============================================================================

-- 1. Todas las columnas con tipo y orden exacto
SELECT 
  ordinal_position as pos,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
ORDER BY ordinal_position;

-- =============================================================================
-- 2. Cantidad de filas en la tabla
-- =============================================================================
SELECT COUNT(*) as total_rows FROM public.shipping_tiers;

-- =============================================================================
-- 3. Si hay filas, mostrar una de muestra
-- =============================================================================
SELECT * FROM public.shipping_tiers LIMIT 3;
