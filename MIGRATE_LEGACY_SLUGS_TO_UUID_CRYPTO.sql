-- =====================================================
-- MIGRACIÓN DIRECTA: Legacy Slugs → UUID Crypto Format
-- =====================================================
-- Actualiza todos los slugs con formato legacy (K2629G372026)
-- al nuevo formato UUID crypto (K3F4A8B2D926)
-- =====================================================
-- ⚠️  SOLO EJECUTAR EN PRE-PRODUCCIÓN
-- =====================================================

BEGIN;

-- Verificar cuántas tiendas tienen formato legacy
DO $$
DECLARE
  v_legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO v_legacy_count
  FROM stores
  WHERE slug IS NOT NULL
    AND slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$';  -- Formato legacy
  
  RAISE NOTICE '📊 Tiendas con formato legacy: %', v_legacy_count;
  
  IF v_legacy_count = 0 THEN
    RAISE NOTICE '✅ No hay tiendas con formato legacy. Nada que migrar.';
  END IF;
END $$;

-- =====================================================
-- MIGRACIÓN: Actualizar slugs uno por uno
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
  RAISE NOTICE '🚀 Iniciando migración de slugs legacy a UUID crypto...';
  RAISE NOTICE '----------------------------------------';
  
  -- Iterar sobre todas las tiendas con formato legacy
  FOR v_store IN 
    SELECT id, slug, name, created_at
    FROM stores
    WHERE slug IS NOT NULL
      AND slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$'  -- Formato legacy
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
        RAISE NOTICE '     Tienda: % (ID: %)', v_store.name, v_store.id;
        
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

-- 1. Contar por formato
SELECT 
  'Formato UUID Crypto' AS formato,
  COUNT(*) as cantidad
FROM stores
WHERE slug ~ '^K[0-9A-F]{10}\d{2}$'

UNION ALL

SELECT 
  'Formato Legacy (debería ser 0)' AS formato,
  COUNT(*) as cantidad
FROM stores
WHERE slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$'

UNION ALL

SELECT 
  'Sin slug' AS formato,
  COUNT(*) as cantidad
FROM stores
WHERE slug IS NULL;

-- 2. Ver ejemplos de slugs migrados
SELECT 
  id,
  name,
  slug,
  CASE 
    WHEN slug ~ '^K[0-9A-F]{10}\d{2}$' THEN '✅ UUID Crypto'
    WHEN slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$' THEN '⚠️ Legacy'
    ELSE '❌ Formato desconocido'
  END as formato,
  created_at,
  updated_at
FROM stores
WHERE slug IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Verificar unicidad
SELECT 
  COUNT(*) as total_tiendas,
  COUNT(DISTINCT slug) as slugs_unicos,
  COUNT(*) - COUNT(DISTINCT slug) as duplicados
FROM stores
WHERE slug IS NOT NULL;

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Todas las tiendas legacy ahora tienen formato: K3F4A8B2D926
-- ✅ URLs nuevas: /tienda/K3F4A8B2D926
-- ✅ No más UUIDs largos en ningún lado
-- ✅ Sistema completamente uniforme
-- =====================================================
