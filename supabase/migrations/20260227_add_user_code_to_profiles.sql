-- =====================================================
-- AGREGAR CAMPO user_code A PROFILES
-- =====================================================
-- Agrega un código único estilo KZ3F4A8B2D926 para cada usuario
-- Similar al store slug pero con prefijo KZ
-- =====================================================

BEGIN;

-- 1. Agregar columna user_code a profiles (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'user_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN user_code TEXT UNIQUE;
    RAISE NOTICE '✅ Columna user_code agregada a profiles';
  ELSE
    RAISE NOTICE '⚠️  Columna user_code ya existe';
  END IF;
END $$;

-- 2. Crear índice único para user_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_code ON profiles(user_code);

-- 3. Comentar la columna
COMMENT ON COLUMN profiles.user_code IS 'Código único de usuario formato KZ + 10 hex + año (ej: KZ3F4A8B2D926)';

COMMIT;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'user_code';
