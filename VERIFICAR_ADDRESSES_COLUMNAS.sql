-- ============================================================================
-- VERIFICAR SI ADDRESSES TIENE LAS COLUMNAS NECESARIAS
-- ============================================================================

-- Ver si department_id y commune_id ya existen en addresses
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'addresses'
  AND column_name IN ('department_id', 'commune_id')
ORDER BY ordinal_position;

-- Si el resultado está VACÍO, ejecuta esto:
-- (Si ya tienes las columnas, NO es necesario ejecutar lo siguiente)

/*
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_id UUID REFERENCES public.communes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.addresses.department_id IS 
  'Departamento seleccionado por el usuario al crear la dirección (para logística local)';

COMMENT ON COLUMN public.addresses.commune_id IS 
  'Comuna seleccionada por el usuario al crear la dirección (para logística local)';

CREATE INDEX IF NOT EXISTS idx_addresses_department_id 
  ON public.addresses(department_id) 
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_commune_id 
  ON public.addresses(commune_id) 
  WHERE commune_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_user_commune 
  ON public.addresses(user_id, commune_id) 
  WHERE commune_id IS NOT NULL;
*/
