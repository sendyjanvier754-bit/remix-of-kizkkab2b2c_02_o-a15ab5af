-- ============================================================================
-- ✅ AGREGAR COLUMNAS FALTANTES A route_logistics_costs
-- ============================================================================

-- Agregar cost_per_cbm (costo por metro cúbico)
ALTER TABLE public.route_logistics_costs
ADD COLUMN IF NOT EXISTS cost_per_cbm DECIMAL(10,4) NOT NULL DEFAULT 0;

-- Agregar min_cost (costo mínimo)
ALTER TABLE public.route_logistics_costs
ADD COLUMN IF NOT EXISTS min_cost DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Verificar que se agregaron correctamente
SELECT 
  '✅ Verificación de columnas agregadas' as info,
  column_name as columna,
  data_type as tipo,
  column_default as valor_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'route_logistics_costs'
  AND column_name IN ('cost_per_cbm', 'min_cost')
ORDER BY column_name;

-- Ver todas las columnas actualizadas
SELECT 
  '📋 TODAS las columnas después del fix' as info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'route_logistics_costs'
ORDER BY ordinal_position;
