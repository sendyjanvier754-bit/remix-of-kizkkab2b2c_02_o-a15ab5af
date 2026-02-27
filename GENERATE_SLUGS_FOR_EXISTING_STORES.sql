-- =====================================================
-- GENERAR SLUGS PARA TIENDAS EXISTENTES
-- =====================================================
-- Propósito: Asegurar que TODAS las tiendas tengan slug único
-- Formato slug: K + 13 dígitos aleatorios (Ejemplo: K2629G372026)
-- =====================================================

-- PASO 1: Verificar cuántas tiendas NO tienen slug
SELECT 
  COUNT(*) as tiendas_sin_slug,
  (SELECT COUNT(*) FROM stores) as total_tiendas
FROM stores
WHERE slug IS NULL OR slug = '';

-- PASO 2: Ver las tiendas que necesitan slug
SELECT 
  id,
  name,
  owner_user_id,
  slug,
  created_at
FROM stores
WHERE slug IS NULL OR slug = ''
ORDER BY created_at DESC;

-- =====================================================
-- PASO 3: GENERAR SLUGS ÚNICOS PARA TIENDAS SIN SLUG
-- =====================================================

DO $$
DECLARE
  v_store RECORD;
  v_slug TEXT;
  v_is_unique BOOLEAN;
  v_attempt INT;
  v_max_attempts INT := 10;
  v_updated_count INT := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando generación de slugs para tiendas...';
  
  -- Iterar sobre todas las tiendas sin slug
  FOR v_store IN 
    SELECT id, name, owner_user_id
    FROM stores
    WHERE slug IS NULL OR slug = ''
    ORDER BY created_at ASC
  LOOP
    RAISE NOTICE '🏪 Procesando tienda: % (owner: %)', 
      COALESCE(v_store.name, 'Sin nombre'), v_store.owner_user_id;
    
    v_is_unique := FALSE;
    v_attempt := 0;
    
    -- Intentar generar slug único (máximo 10 intentos)
    WHILE NOT v_is_unique AND v_attempt < v_max_attempts LOOP
      -- Generar slug usando UUID криптографicamente seguro
      -- Formato: K + 10 caracteres hex + año
      -- Espacio: 16^10 = 1.1 trillones (prácticamente 0% colisión)
      v_slug := 'K' || 
                UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
                EXTRACT(YEAR FROM NOW())::TEXT;
      
      -- Verificar si el slug ya existe
      SELECT NOT EXISTS(
        SELECT 1 FROM stores WHERE slug = v_slug
      ) INTO v_is_unique;
      
      v_attempt := v_attempt + 1;
      
      IF NOT v_is_unique THEN
        RAISE NOTICE '  ⚠️ Slug % ya existe, reintentando...', v_slug;
      END IF;
    END LOOP;
    
    IF v_is_unique THEN
      -- Actualizar la tienda con el nuevo slug
      UPDATE stores
      SET slug = v_slug
      WHERE id = v_store.id;
      
      v_updated_count := v_updated_count + 1;
      RAISE NOTICE '  ✅ Slug generado: %', v_slug;
    ELSE
      RAISE WARNING '  ❌ No se pudo generar slug único para tienda % después de % intentos', 
        v_store.id, v_max_attempts;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Generación de slugs completada!';
  RAISE NOTICE '📊 Tiendas actualizadas: %', v_updated_count;
END $$;

-- =====================================================
-- PASO 4: VERIFICAR QUE TODAS LAS TIENDAS TIENEN SLUG
-- =====================================================

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ TODAS las tiendas tienen slug'
    ELSE '⚠️ ' || COUNT(*) || ' tiendas AÚN sin slug'
  END as resultado
FROM stores
WHERE slug IS NULL OR slug = '';

-- Ver distribución de slugs generados
SELECT 
  COUNT(*) as total_tiendas,
  COUNT(DISTINCT slug) as slugs_unicos,
  COUNT(*) FILTER (WHERE slug LIKE 'K%') as slugs_formato_k,
  COUNT(*) FILTER (WHERE slug LIKE 'KZ%') as slugs_formato_kz_antiguo
FROM stores;

-- =====================================================
-- PASO 5: VERIFICAR INTEGRIDAD DE SLUGS
-- =====================================================

-- Detectar slugs duplicados (no debería haber ninguno)
SELECT 
  slug,
  COUNT(*) as tiendas_con_mismo_slug,
  ARRAY_AGG(id) as store_ids
FROM stores
WHERE slug IS NOT NULL
GROUP BY slug
HAVING COUNT(*) > 1;

-- Ver ejemplos de slugs generados
SELECT 
  id,
  name,
  slug,
  created_at,
  LENGTH(slug) as slug_length
FROM stores
WHERE slug IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
