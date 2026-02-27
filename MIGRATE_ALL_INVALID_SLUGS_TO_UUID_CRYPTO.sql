-- =====================================================
-- MIGRACIÓN COMPLETA: TODOS los formatos incorrectos → UUID Crypto
-- =====================================================
-- Actualiza CUALQUIER slug que NO sea UUID crypto al nuevo formato
-- Incluye: Legacy (K2629G372026), Antiguo KZ (KZ6296372026), otros
-- =====================================================
-- ⚠️  SOLO EJECUTAR EN PRE-PRODUCCIÓN
-- =====================================================

BEGIN;

-- Verificar cuántas tiendas necesitan migración
DO $$
DECLARE
  v_invalid_count INT;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM stores
  WHERE slug IS NOT NULL
    AND slug !~ '^K[0-9A-F]{10}\d{2}$';  -- NO es formato UUID crypto
  
  RAISE NOTICE '📊 Tiendas que necesitan migración: %', v_invalid_count;
  
  IF v_invalid_count = 0 THEN
    RAISE NOTICE '✅ TODAS las tiendas ya tienen formato UUID crypto. Nada que migrar.';
  END IF;
END $$;

-- =====================================================
-- MIGRACIÓN: Actualizar TODOS los slugs incorrectos
-- =====================================================

DO $$
DECLARE
  v_store RECORD;
  v_new_slug TEXT;
  v_old_slug TEXT;
  v_attempt INT;
  v_max_attempts INT := 10;
  v_migrated_count INT := 0;
  v_failed_count INT := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando migración de TODOS los slugs a UUID crypto...';
  RAISE NOTICE '----------------------------------------';
  
  -- Iterar sobre TODAS las tiendas que NO tengan formato UUID crypto
  FOR v_store IN 
    SELECT id, slug, name, created_at
    FROM stores
    WHERE slug IS NOT NULL
      AND slug !~ '^K[0-9A-F]{10}\d{2}$'  -- NO es UUID crypto
    ORDER BY created_at ASC
  LOOP
    v_old_slug := v_store.slug;
    v_attempt := 0;
    
    -- Intentar generar un slug único (máximo 10 intentos)
    LOOP
      v_attempt := v_attempt + 1;
      
      -- Generar nuevo slug con UUID crypto
      v_new_slug := 'K' || 
                    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
                    SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
      
      -- Verificar si ya existe
      IF NOT EXISTS(SELECT 1 FROM stores WHERE slug = v_new_slug) THEN
        EXIT; -- Slug único encontrado
      END IF;
      
      -- Si llegamos a 10 intentos, abortar esta tienda
      IF v_attempt >= v_max_attempts THEN
        RAISE WARNING '  ❌ No se pudo generar slug único para tienda % después de % intentos', 
          v_store.id, v_max_attempts;
        v_failed_count := v_failed_count + 1;
        EXIT;
      END IF;
    END LOOP;
    
    -- Si se encontró un slug único, actualizar
    IF v_attempt < v_max_attempts THEN
      BEGIN
        UPDATE stores
        SET slug = v_new_slug,
            updated_at = NOW()
        WHERE id = v_store.id;
        
        v_migrated_count := v_migrated_count + 1;
        
        RAISE NOTICE '  ✅ % → %', v_old_slug, v_new_slug;
        RAISE NOTICE '     Tienda: % (ID: %)', COALESCE(v_store.name, 'Sin nombre'), v_store.id;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '  ❌ Error actualizando tienda %: %', v_store.id, SQLERRM;
        v_failed_count := v_failed_count + 1;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '✅ Migración completada!';
  RAISE NOTICE '📊 Estadísticas:';
  RAISE NOTICE '   - Tiendas migradas exitosamente: %', v_migrated_count;
  RAISE NOTICE '   - Tiendas fallidas: %', v_failed_count;
  
END $$;

-- =====================================================
-- VERIFICACIÓN: Confirmar que la migración funcionó
-- =====================================================

-- 1. Contar por formato (DESPUÉS de migración)
SELECT 
  CASE 
    WHEN slug ~ '^K[0-9A-F]{10}\d{2}$' THEN '✅ UUID Crypto'
    WHEN slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$' THEN '⚠️ Legacy (debería ser 0)'
    WHEN slug ~ '^KZ\d+$' THEN '❌ ANTIGUO KZ (debería ser 0)'
    WHEN slug LIKE 'K%' THEN '⚠️ Otro formato K'
    ELSE '❌ Formato desconocido'
  END as formato,
  COUNT(*) as cantidad
FROM stores
WHERE slug IS NOT NULL
GROUP BY formato
ORDER BY cantidad DESC;

-- 2. Ver ejemplos de slugs migrados
SELECT 
  id,
  name,
  slug,
  CASE 
    WHEN slug ~ '^K[0-9A-F]{10}\d{2}$' THEN '✅ UUID Crypto (CORRECTO)'
    ELSE '❌ Formato incorrecto'
  END as formato,
  LENGTH(slug) as slug_length,
  created_at,
  updated_at
FROM stores
WHERE slug IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Verificar unicidad (NO debe haber duplicados)
SELECT 
  COUNT(*) as total_tiendas,
  COUNT(DISTINCT slug) as slugs_unicos,
  COUNT(*) - COUNT(DISTINCT slug) as duplicados
FROM stores
WHERE slug IS NOT NULL;

-- ¿Hay duplicados? (debería devolver 0 filas)
SELECT 
  slug,
  COUNT(*) as num_duplicados,
  ARRAY_AGG(id) as store_ids
FROM stores
WHERE slug IS NOT NULL
GROUP BY slug
HAVING COUNT(*) > 1;

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Formato UUID Crypto: 2 tiendas (100%)
-- ❌ Legacy: 0 (migrado)
-- ❌ ANTIGUO KZ: 0 (migrado)
-- ❌ Otros: 0 (migrado)
-- ✅ Duplicados: 0
-- =====================================================
-- Ejemplos de slugs DESPUÉS de migración:
-- KZ6296372026 → K3F4A8B2D926 ✅
-- K2629G372026 → KA5C9E7B1F26 ✅
-- =====================================================
