
-- =====================================================
-- Auto-generar user_code al crear perfil + backfill existentes
-- =====================================================

-- 1. Función para generar user_code único
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_code := 'KZ' || 
              UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
              SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
    
    -- Verificar unicidad
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    IF v_attempts >= 10 THEN
      RAISE EXCEPTION 'No se pudo generar user_code único después de 10 intentos';
    END IF;
  END LOOP;
END;
$$;

-- 2. Trigger: auto-asignar user_code al crear perfil
CREATE OR REPLACE FUNCTION public.auto_assign_user_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := public.generate_user_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_user_code ON profiles;
CREATE TRIGGER trigger_auto_assign_user_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_user_code();

-- 3. Backfill: generar user_code para perfiles existentes sin código
DO $$
DECLARE
  v_profile RECORD;
  v_code TEXT;
BEGIN
  FOR v_profile IN 
    SELECT id FROM profiles WHERE user_code IS NULL
  LOOP
    v_code := public.generate_user_code();
    UPDATE profiles SET user_code = v_code WHERE id = v_profile.id;
  END LOOP;
END $$;
