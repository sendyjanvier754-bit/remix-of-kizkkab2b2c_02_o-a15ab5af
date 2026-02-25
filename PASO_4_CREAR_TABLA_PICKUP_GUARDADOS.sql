-- ============================================================================
-- PASO 4: CREAR TABLA PARA PUNTOS DE RETIRO GUARDADOS
-- ============================================================================
-- Solo ejecuta esto si el PASO_3 mostró resultado VACÍO

CREATE TABLE IF NOT EXISTS public.user_saved_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_point_id UUID NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  commune_id UUID REFERENCES public.communes(id) ON DELETE SET NULL,
  label TEXT DEFAULT 'Mi punto de retiro',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pickup_point_id)
);

-- Comentarios para la tabla
COMMENT ON TABLE public.user_saved_pickup_points IS 
  'Puntos de retiro guardados por usuarios para reutilizar en futuros pedidos';

COMMENT ON COLUMN public.user_saved_pickup_points.label IS 
  'Etiqueta personalizada (ej: "Cerca de mi trabajo", "Punto Central")';

COMMENT ON COLUMN public.user_saved_pickup_points.department_id IS 
  'Departamento del punto (para cálculo de logística local)';

COMMENT ON COLUMN public.user_saved_pickup_points.commune_id IS 
  'Comuna del punto (para cálculo de logística local)';

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_saved_pickup_user_id 
  ON public.user_saved_pickup_points(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_pickup_point_id 
  ON public.user_saved_pickup_points(pickup_point_id);

CREATE INDEX IF NOT EXISTS idx_saved_pickup_commune 
  ON public.user_saved_pickup_points(commune_id) 
  WHERE commune_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_pickup_user_default 
  ON public.user_saved_pickup_points(user_id, is_default) 
  WHERE is_default = true;

-- ✅ Listo! Ahora continúa con PASO_5
