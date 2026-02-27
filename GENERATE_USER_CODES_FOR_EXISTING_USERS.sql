-- =====================================================
-- MIGRACIÓN: Generar user_code para usuarios existentes
-- =====================================================
-- Genera códigos KZ3F4A8B2D926 para todos los usuarios sin user_code
-- =====================================================

BEGIN;

-- Verificar cuántos usuarios necesitan user_code
DO $$
DECLARE
  v_users_without_code INT;
BEGIN
  SELECT COUNT(*) INTO v_users_without_code
  FROM profiles
  WHERE user_code IS NULL;
  
  RAISE NOTICE '📊 Usuarios sin user_code: %', v_users_without_code;
END $$;

-- Generar user_code para todos los usuarios
DO $$
DECLARE
  v_profile RECORD;
  v_new_code TEXT;
  v_attempt INT;
  v_max_attempts INT := 10;
  v_migrated_count INT := 0;
  v_failed_count INT := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando generación de user_code...';
  RAISE NOTICE '----------------------------------------';
  
  FOR v_profile IN 
    SELECT id, full_name, email
    FROM profiles
    WHERE user_code IS NULL
    ORDER BY created_at ASC
  LOOP
    v_attempt := 0;
    
    -- Intentar generar un código único
    LOOP
      v_attempt := v_attempt + 1;
      
      -- Generar nuevo código con UUID crypto
      -- Formato: KZ + 10 hex + año
      v_new_code := 'KZ' || 
                    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
                    SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
      
      -- Verificar si ya existe
      IF NOT EXISTS(SELECT 1 FROM profiles WHERE user_code = v_new_code) THEN
        EXIT; -- Código único encontrado
      END IF;
      
      -- Si llegamos a 10 intentos, abortar
      IF v_attempt >= v_max_attempts THEN
        RAISE WARNING '  ❌ No se pudo generar código único para usuario % después de % intentos', 
          v_profile.id, v_max_attempts;
        v_failed_count := v_failed_count + 1;
        EXIT;
      END IF;
    END LOOP;
    
    -- Si se encontró un código único, actualizar
    IF v_attempt < v_max_attempts THEN
      BEGIN
        UPDATE profiles
        SET user_code = v_new_code
        WHERE id = v_profile.id;
        
        v_migrated_count := v_migrated_count + 1;
        
        RAISE NOTICE '  ✅ %: %', 
          COALESCE(v_profile.full_name, v_profile.email, 'Usuario sin nombre'), 
          v_new_code;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '  ❌ Error actualizando usuario %: %', v_profile.id, SQLERRM;
        v_failed_count := v_failed_count + 1;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '✅ Migración completada!';
  RAISE NOTICE '📊 Estadísticas:';
  RAISE NOTICE '   - Usuarios migrados: %', v_migrated_count;
  RAISE NOTICE '   - Usuarios fallidos: %', v_failed_count;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- 1. Verificar formato correcto
SELECT 
  CASE 
    WHEN user_code ~ '^KZ[0-9A-F]{10}\d{2}$' THEN '✅ Formato correcto'
    WHEN user_code IS NULL THEN '❌ Sin código'
    ELSE '⚠️ Formato incorrecto'
  END as formato,
  COUNT(*) as cantidad
FROM profiles
GROUP BY formato;

-- 2. Ver ejemplos
SELECT 
  id,
  full_name,
  email,
  user_code,
  LENGTH(user_code) as code_length,
  created_at
FROM profiles
WHERE user_code IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar unicidad
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(DISTINCT user_code) as codigos_unicos,
  COUNT(*) - COUNT(DISTINCT user_code) as duplicados
FROM profiles
WHERE user_code IS NOT NULL;

-- 4. Detectar duplicados (no debería haber)
SELECT 
  user_code,
  COUNT(*) as num_duplicados,
  ARRAY_AGG(id) as user_ids
FROM profiles
WHERE user_code IS NOT NULL
GROUP BY user_code
HAVING COUNT(*) > 1;

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Formato correcto: 100% de usuarios
-- ✅ Duplicados: 0
-- ✅ Longitud código: 13 caracteres (KZ + 10 hex + año)
-- Ejemplos: KZ3F4A8B2D926, KZD7E2A4B91C26, KZAA1234FF5526
-- =====================================================
