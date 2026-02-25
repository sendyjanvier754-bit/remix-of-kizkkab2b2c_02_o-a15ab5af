-- ============================================================================
-- PASO 5: HABILITAR RLS (ROW LEVEL SECURITY) 
-- ============================================================================
-- Ejecuta esto para proteger la tabla de puntos guardados

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

-- ✅ Listo! Ahora continúa con PASO_6 (verificación final)
