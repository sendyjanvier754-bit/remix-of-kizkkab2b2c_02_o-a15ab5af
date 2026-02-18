-- ============================================================================
-- ✅ AGREGAR COLUMNA transport_type A route_logistics_costs
-- ============================================================================

-- Agregar transport_type (tipo de transporte: 'maritimo', 'aereo', 'terrestre')
ALTER TABLE public.route_logistics_costs
ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

-- Actualizar todos los tramos existentes a 'aereo'
UPDATE public.route_logistics_costs
SET transport_type = 'aereo'
WHERE transport_type != 'aereo' OR transport_type IS NULL;

-- Verificar que se agregó correctamente
SELECT 
  '✅ Columna transport_type agregada' as info,
  column_name as columna,
  data_type as tipo,
  column_default as valor_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'route_logistics_costs'
  AND column_name = 'transport_type';

-- Ver todos los tramos actualizados
SELECT 
  '📦 Tramos actualizados a aereo' as info,
  id,
  segment,
  transport_type,
  cost_per_kg,
  estimated_days_min,
  estimated_days_max
FROM public.route_logistics_costs
ORDER BY segment;

-- Ver estructura completa actualizada
SELECT 
  '📋 Todas las columnas de route_logistics_costs' as info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'route_logistics_costs'
ORDER BY ordinal_position;
