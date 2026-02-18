-- ============================================================================
-- 🔄 REFRESCAR SCHEMA CACHE DE SUPABASE
-- ============================================================================

-- Opción 1: Verificar nombre actual de la columna
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'route_logistics_costs'
  AND column_name LIKE '%cbm%' OR column_name LIKE '%cbn%';

-- Opción 2: Si la columna es 'cost_per_cbn' (typo), renombrarla
-- SOLO EJECUTAR SI LA VERIFICACIÓN ANTERIOR MUESTRA 'cost_per_cbn'
-- ALTER TABLE route_logistics_costs 
-- RENAME COLUMN cost_per_cbn TO cost_per_cbm;

-- Opción 3: Si no existe, agregarla
-- ALTER TABLE route_logistics_costs 
-- ADD COLUMN IF NOT EXISTS cost_per_cbm DECIMAL(10,4) NOT NULL DEFAULT 0;
