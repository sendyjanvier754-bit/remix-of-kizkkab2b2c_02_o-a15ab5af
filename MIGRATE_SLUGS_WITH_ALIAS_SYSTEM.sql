-- =====================================================
-- MIGRACIÓN SEGURA: Sistema de Alias para Slugs
-- =====================================================
-- Permite que AMBOS slugs (viejo y nuevo) funcionen
-- URLs antiguas siguen funcionando, nuevas URLs usan formato nuevo
-- =====================================================

-- PASO 1: Crear tabla de alias
CREATE TABLE IF NOT EXISTS store_slug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slug_alias TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_store_slug_alias UNIQUE(store_id, slug_alias)
);

CREATE INDEX idx_store_slug_aliases_slug ON store_slug_aliases(slug_alias);
CREATE INDEX idx_store_slug_aliases_store_id ON store_slug_aliases(store_id);

COMMENT ON TABLE store_slug_aliases IS 'Permite múltiples slugs por tienda para backward compatibility';
COMMENT ON COLUMN store_slug_aliases.is_primary IS 'El slug principal que se muestra en la UI';

-- =====================================================
-- PASO 2: Migrar slugs existentes a alias
-- =====================================================

DO $$
DECLARE
  v_store RECORD;
  v_new_slug TEXT;
  v_old_slug TEXT;
  v_migrated_count INT := 0;
BEGIN
  RAISE NOTICE '🚀 Iniciando migración de slugs con sistema de alias...';
  
  -- Iterar sobre tiendas con formato legacy
  FOR v_store IN 
    SELECT id, slug
    FROM stores
    WHERE slug IS NOT NULL
      AND slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$'  -- Formato legacy
    ORDER BY created_at ASC
  LOOP
    v_old_slug := v_store.slug;
    
    -- Generar nuevo slug UUID crypto
    v_new_slug := 'K' || 
                  UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
                  SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
    
    -- Verificar que el nuevo slug no exista
    WHILE EXISTS(SELECT 1 FROM stores WHERE slug = v_new_slug) OR
          EXISTS(SELECT 1 FROM store_slug_aliases WHERE slug_alias = v_new_slug) LOOP
      v_new_slug := 'K' || 
                    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) ||
                    SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
    END LOOP;
    
    BEGIN
      -- 1. Guardar slug legacy como alias
      INSERT INTO store_slug_aliases (store_id, slug_alias, is_primary)
      VALUES (v_store.id, v_old_slug, false)
      ON CONFLICT (store_id, slug_alias) DO NOTHING;
      
      -- 2. Actualizar slug principal a nuevo formato
      UPDATE stores
      SET slug = v_new_slug
      WHERE id = v_store.id;
      
      -- 3. Registrar nuevo slug como alias principal
      INSERT INTO store_slug_aliases (store_id, slug_alias, is_primary)
      VALUES (v_store.id, v_new_slug, true)
      ON CONFLICT (store_id, slug_alias) DO UPDATE SET is_primary = true;
      
      v_migrated_count := v_migrated_count + 1;
      
      RAISE NOTICE '  ✅ Migrado: % → % (legacy: %)', 
        v_store.id, v_new_slug, v_old_slug;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ❌ Error migrando store %: %', v_store.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Migración completada!';
  RAISE NOTICE '📊 Tiendas migradas: %', v_migrated_count;
END $$;

-- =====================================================
-- PASO 3: Función para resolver slugs (ambos formatos)
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_store_by_slug(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Intentar encontrar por slug principal
  SELECT id INTO v_store_id
  FROM stores
  WHERE slug = p_slug;
  
  -- Si no encuentra, buscar en alias
  IF v_store_id IS NULL THEN
    SELECT store_id INTO v_store_id
    FROM store_slug_aliases
    WHERE slug_alias = p_slug;
  END IF;
  
  RETURN v_store_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASO 4: Verificación
-- =====================================================

-- Ver tiendas con ambos slugs
SELECT 
  s.id,
  s.slug as slug_actual,
  ARRAY_AGG(sa.slug_alias ORDER BY sa.is_primary DESC) as todos_los_slugs,
  COUNT(sa.slug_alias) as num_alias
FROM stores s
LEFT JOIN store_slug_aliases sa ON s.id = sa.store_id
WHERE s.slug IS NOT NULL
GROUP BY s.id, s.slug
ORDER BY s.created_at DESC
LIMIT 10;

-- Verificar que ambos formatos funcionan
-- Ejemplo: SELECT resolve_store_by_slug('K2629G372026');  -- Slug legacy
-- Ejemplo: SELECT resolve_store_by_slug('K3F4A8B2D926');  -- Slug nuevo

-- =====================================================
-- PASO 5: Estadísticas
-- =====================================================

SELECT 
  COUNT(DISTINCT s.id) as total_tiendas,
  COUNT(DISTINCT sa.slug_alias) as total_alias,
  COUNT(DISTINCT s.id) FILTER (WHERE s.slug ~ '^K[0-9A-F]{10}\d{2}$') as formato_nuevo,
  COUNT(DISTINCT s.id) FILTER (WHERE s.slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$') as formato_legacy
FROM stores s
LEFT JOIN store_slug_aliases sa ON s.id = sa.store_id;
