-- ============================================================================
-- PASO 2: AGREGAR COLUMNAS A ADDRESSES
-- ============================================================================
-- Solo ejecuta esto si el PASO_1 mostró resultado VACÍO

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_id UUID REFERENCES public.communes(id) ON DELETE SET NULL;

-- Comentarios para las columnas
COMMENT ON COLUMN public.addresses.department_id IS 
  'Departamento seleccionado por el usuario al crear la dirección (para logística local)';

COMMENT ON COLUMN public.addresses.commune_id IS 
  'Comuna seleccionada por el usuario al crear la dirección (para logística local)';

-- Crear índices para mejorar las consultas
CREATE INDEX IF NOT EXISTS idx_addresses_department_id 
  ON public.addresses(department_id) 
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_commune_id 
  ON public.addresses(commune_id) 
  WHERE commune_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_user_commune 
  ON public.addresses(user_id, commune_id) 
  WHERE commune_id IS NOT NULL;

-- ✅ Listo! Ahora continúa con PASO_3
