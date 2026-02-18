-- ============================================================================
-- FIX: Renombrar shipping_route_id a route_id en shipping_tiers
-- Fecha: 2026-02-16
-- Problema: El frontend usa route_id pero la BD tiene shipping_route_id
-- ============================================================================

-- 1. Verificar si la columna shipping_route_id existe y renombrarla
DO $$ 
BEGIN
  -- Si existe shipping_route_id, renombrarla a route_id
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'shipping_tiers' 
      AND column_name = 'shipping_route_id'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.shipping_tiers 
    RENAME COLUMN shipping_route_id TO route_id;
    
    RAISE NOTICE 'Columna shipping_route_id renombrada a route_id exitosamente';
  ELSE
    RAISE NOTICE 'La columna route_id ya existe o shipping_route_id no existe';
  END IF;
END $$;

-- 2. Verificar índices y recrearlos si es necesario
DROP INDEX IF EXISTS public.idx_shipping_tiers_route;
DROP INDEX IF EXISTS public.idx_shipping_tiers_route_id;

CREATE INDEX IF NOT EXISTS idx_shipping_tiers_route_id 
ON public.shipping_tiers(route_id, tier_type);

-- 3. Verificar constraint UNIQUE
DO $$ 
BEGIN
  -- Eliminar constraint antiguo si existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_route_tier' 
      AND table_name = 'shipping_tiers'
  ) THEN
    ALTER TABLE public.shipping_tiers DROP CONSTRAINT unique_route_tier;
  END IF;
  
  -- Recrear con nombre correcto de columna
  ALTER TABLE public.shipping_tiers 
  ADD CONSTRAINT unique_route_tier UNIQUE(route_id, tier_type);
  
EXCEPTION WHEN duplicate_table THEN
  -- constraint ya existe, ignorar
  RAISE NOTICE 'Constraint unique_route_tier ya existe';
END $$;

-- 4. Verificar que la columna tenga el foreign key correcto
DO $$ 
BEGIN
  -- Eliminar FK antiguo si existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%shipping_route_id_fkey%' 
      AND table_name = 'shipping_tiers'
  ) THEN
    ALTER TABLE public.shipping_tiers 
    DROP CONSTRAINT IF EXISTS shipping_tiers_shipping_route_id_fkey;
  END IF;
  
  -- Agregar FK con nombre correcto si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'shipping_tiers_route_id_fkey' 
      AND table_name = 'shipping_tiers'
  ) THEN
    ALTER TABLE public.shipping_tiers 
    ADD CONSTRAINT shipping_tiers_route_id_fkey 
    FOREIGN KEY (route_id) 
    REFERENCES public.shipping_routes(id) 
    ON DELETE CASCADE;
  END IF;
  
END $$;

-- 5. Actualizar vistas que dependan de esta columna (si existen)
-- Recrear vista v_logistics_data si usa shipping_route_id
DROP VIEW IF EXISTS public.v_logistics_data CASCADE;

-- 6. Verificar resultado
SELECT 
  '✅ VERIFICACIÓN FINAL' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND table_schema = 'public'
  AND column_name IN ('route_id', 'shipping_route_id')
ORDER BY column_name;

COMMENT ON COLUMN public.shipping_tiers.route_id IS 'Foreign key to shipping_routes table (formerly shipping_route_id)';
