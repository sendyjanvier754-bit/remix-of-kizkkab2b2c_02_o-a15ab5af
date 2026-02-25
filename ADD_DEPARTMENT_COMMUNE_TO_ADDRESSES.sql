-- ============================================================================
-- AGREGAR DEPARTMENT_ID Y COMMUNE_ID A ADDRESSES + CREAR TABLA PUNTOS GUARDADOS
-- ============================================================================
-- OBJETIVO: 
--   1. Permitir que cuando se guarde/actualice una dirección,
--      se guarden también el departamento y comuna seleccionados
--      para que el costo de logística local se actualice automáticamente.
--   2. Crear tabla separada para que usuarios guarden sus puntos de retiro
--      favoritos y reutilizarlos en futuros pedidos con logística local.
-- FECHA: 25-Feb-2026
-- ============================================================================

-- ✅ PASO 1: Agregar columnas department_id y commune_id a addresses

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_id UUID REFERENCES public.communes(id) ON DELETE SET NULL;

-- Comentarios para las columnas
COMMENT ON COLUMN public.addresses.department_id IS 
  'Departamento seleccionado por el usuario al crear la dirección (para logística local)';

COMMENT ON COLUMN public.addresses.commune_id IS 
  'Comuna seleccionada por el usuario al crear la dirección (para logística local)';

-- ✅ PASO 2: Crear tabla para puntos de retiro guardados por usuarios

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

-- ✅ PASO 3: Crear índices para mejorar las consultas

-- Índices para addresses
CREATE INDEX IF NOT EXISTS idx_addresses_department_id 
  ON public.addresses(department_id) 
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_commune_id 
  ON public.addresses(commune_id) 
  WHERE commune_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_user_commune 
  ON public.addresses(user_id, commune_id) 
  WHERE commune_id IS NOT NULL;

-- Índices para user_saved_pickup_points
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

-- ✅ PASO 4: Habilitar RLS (Row Level Security) para la nueva tabla

ALTER TABLE public.user_saved_pickup_points ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver sus propios puntos guardados
CREATE POLICY "Users can view own saved pickup points"
  ON public.user_saved_pickup_points
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Los usuarios pueden insertar sus propios puntos guardados
CREATE POLICY "Users can insert own saved pickup points"
  ON public.user_saved_pickup_points
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios pueden actualizar sus propios puntos guardados
CREATE POLICY "Users can update own saved pickup points"
  ON public.user_saved_pickup_points
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios pueden eliminar sus propios puntos guardados
CREATE POLICY "Users can delete own saved pickup points"
  ON public.user_saved_pickup_points
  FOR DELETE
  USING (auth.uid() = user_id);

-- ✅ PASO 5: Verificar que las columnas se agregaron correctamente

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

-- ✅ PASO 6: Ver la estructura de la nueva tabla

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_saved_pickup_points'
ORDER BY ordinal_position;

-- ============================================================================
-- RESULTADOS ESPERADOS:
-- ============================================================================
-- ✅ Se agregaron las columnas department_id y commune_id a addresses
-- ✅ Se creó la tabla user_saved_pickup_points
-- ✅ Se crearon índices para mejorar performance
-- ✅ Las columnas tienen FK constraints a departments, communes y pickup_points
-- ✅ ON DELETE SET NULL para mantener las direcciones si se elimina un dept/commune
-- ✅ ON DELETE CASCADE para user_saved_pickup_points (si se borra el usuario o punto)
-- ✅ RLS habilitado para user_saved_pickup_points
-- ✅ Constraint UNIQUE (user_id, pickup_point_id) evita duplicados
-- ============================================================================

-- ============================================================================
-- PRUEBA END-TO-END:
-- ============================================================================
-- 🏠 CASO 1: DIRECCIÓN DE ENVÍO A DOMICILIO
-- 1. El usuario crea/edita una dirección en el checkout
-- 2. Selecciona departamento y comuna en el formulario
-- 3. Al guardar, department_id y commune_id se guardan en addresses
-- 4. Al cargar la dirección posteriormente, el sistema restaura automáticamente
--    el dept/commune y calcula el costo de logística local
--
-- 📦 CASO 2: PUNTO DE RETIRO FAVORITO
-- 1. El usuario selecciona un punto de retiro en el checkout
-- 2. Marca "Guardar este punto para futuros pedidos"
-- 3. Se crea un registro en user_saved_pickup_points con:
--    - user_id (del usuario actual)
--    - pickup_point_id (ID del punto seleccionado)
--    - department_id y commune_id (del punto, para logística local)
--    - label (nombre personalizado o nombre del punto)
-- 4. En próximos pedidos, el usuario puede:
--    - Ver sus puntos guardados en una sección "Puntos Favoritos"
--    - Seleccionar un punto guardado directamente
--    - El sistema calcula automáticamente el costo de logística local
--      usando el commune_id guardado (igual que con addresses)
--
-- 💰 CÁLCULO DE LOGÍSTICA LOCAL (mismo para ambos casos):
-- - Para direcciones: usa addresses.commune_id + peso del carrito
-- - Para puntos guardados: usa user_saved_pickup_points.commune_id + peso del carrito
-- - Ambos usan la misma función/lógica de cálculo de costo
-- ============================================================================
