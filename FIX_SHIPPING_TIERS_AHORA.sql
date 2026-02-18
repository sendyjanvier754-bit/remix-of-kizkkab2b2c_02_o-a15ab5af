-- ============================================================================
-- SOLUCIÓN RÁPIDA: Ejecuta esto AHORA en el SQL Editor de Supabase
-- ============================================================================
-- Problema: El código frontend usa 'route_id' pero la tabla tiene 'shipping_route_id'
-- Solución: Renombrar la columna para que coincida con el código
-- ============================================================================

-- Paso 1: Renombrar columna
ALTER TABLE public.shipping_tiers 
RENAME COLUMN shipping_route_id TO route_id;

-- Paso 2: Actualizar índice
DROP INDEX IF EXISTS public.idx_shipping_tiers_route;
CREATE INDEX idx_shipping_tiers_route_id ON public.shipping_tiers(route_id, tier_type);

-- Paso 3: Verificar el cambio
SELECT 
  '✅ Columnas de shipping_tiers:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
  AND column_name LIKE '%route%'
ORDER BY column_name;

-- ¡LISTO! Ahora deberías poder crear tipos de envío sin errores
