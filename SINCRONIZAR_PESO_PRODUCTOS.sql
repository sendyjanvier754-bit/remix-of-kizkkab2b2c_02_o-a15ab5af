-- =============================================================================
-- SINCRONIZACIÓN Y LIMPIEZA DE COLUMNAS DE PESO EN PRODUCTS
-- Fecha: 2026-02-12
-- Objetivo: Convertir g ↔ kg para tener ambas unidades completas
-- =============================================================================

-- =============================================================================
-- PASO 1: DIAGNÓSTICO - Ver qué columnas tienen datos
-- =============================================================================

SELECT 
  'Diagnóstico de columnas de peso' as informe;

SELECT 
  COUNT(*) as total_productos,
  COUNT(weight_kg) as tiene_weight_kg,
  COUNT(peso_kg) as tiene_peso_kg,
  COUNT(weight_g) as tiene_weight_g,
  COUNT(peso_g) as tiene_peso_g,
  
  -- Verificar cuáles tienen valores > 0
  COUNT(CASE WHEN weight_kg > 0 THEN 1 END) as weight_kg_mayor_cero,
  COUNT(CASE WHEN peso_kg > 0 THEN 1 END) as peso_kg_mayor_cero,
  COUNT(CASE WHEN weight_g > 0 THEN 1 END) as weight_g_mayor_cero,
  COUNT(CASE WHEN peso_g > 0 THEN 1 END) as peso_g_mayor_cero,
  
  -- Promedio de valores (excluyendo ceros)
  ROUND(AVG(NULLIF(weight_kg, 0)), 3) as avg_weight_kg,
  ROUND(AVG(NULLIF(peso_kg, 0)), 3) as avg_peso_kg,
  ROUND(AVG(NULLIF(weight_g, 0)), 1) as avg_weight_g,
  ROUND(AVG(NULLIF(peso_g, 0)), 1) as avg_peso_g
FROM products
WHERE is_active = TRUE;

-- =============================================================================
-- PASO 2: Ver ejemplos de productos con peso
-- =============================================================================

SELECT 
  id,
  nombre,
  sku_interno,
  weight_kg,
  peso_kg,
  weight_g,
  peso_g,
  CASE 
    WHEN peso_g > 0 THEN 'Usa peso_g'
    WHEN peso_kg > 0 THEN 'Usa peso_kg'
    WHEN weight_g > 0 THEN 'Usa weight_g'
    WHEN weight_kg > 0 THEN 'Usa weight_kg'
    ELSE 'Sin peso'
  END as estado_peso
FROM products
WHERE is_active = TRUE
AND (
  COALESCE(weight_kg, peso_kg, 0) > 0 
  OR COALESCE(weight_g, peso_g, 0) > 0
)
LIMIT 20;

-- =============================================================================
-- PASO 3: SINCRONIZACIÓN - Convertir gramos ↔ kilogramos
-- =============================================================================

-- BACKUP: Crear tabla de respaldo antes de modificar
CREATE TABLE IF NOT EXISTS products_peso_backup_20260212 AS
SELECT id, weight_kg, peso_kg, weight_g, peso_g, updated_at
FROM products;

-- Sincronizar: peso_g (gramos) y peso_kg (kilogramos)
-- Copiar de weight_* a peso_* y convertir g <-> kg

UPDATE products
SET 
  -- Asignar peso_kg: prioridad peso_kg > peso_g convertido > weight_kg > weight_g convertido
  peso_kg = COALESCE(
    NULLIF(peso_kg, 0),
    NULLIF(peso_g, 0) / 1000.0,
    NULLIF(weight_kg, 0),
    NULLIF(weight_g, 0) / 1000.0,
    0
  ),
  
  -- Asignar peso_g: prioridad peso_g > peso_kg convertido > weight_g > weight_kg convertido
  peso_g = COALESCE(
    NULLIF(peso_g, 0),
    NULLIF(peso_kg, 0) * 1000.0,
    NULLIF(weight_g, 0),
    NULLIF(weight_kg, 0) * 1000.0,
    0
  ),
  
  updated_at = NOW()
WHERE is_active = TRUE
AND (
  -- Tiene datos en alguna columna de peso
  weight_kg > 0 OR peso_kg > 0 OR weight_g > 0 OR peso_g > 0
);

-- =============================================================================
-- PASO 4: VERIFICACIÓN - Comprobar que la sincronización funcionó
-- =============================================================================

SELECT 
  'Verificación después de sincronización' as informe;

SELECT 
  id,
  nombre,
  sku_interno,
  peso_kg as peso_en_kg,
  peso_g as peso_en_gramos,
  ROUND(peso_g / 1000.0, 3) as peso_g_convertido_a_kg,
  CASE 
    WHEN ABS(peso_kg - (peso_g / 1000.0)) < 0.01 THEN 'Sincronizado'
    WHEN peso_kg > 0 AND peso_g > 0 THEN 'Desincronizado'
    WHEN peso_kg > 0 OR peso_g > 0 THEN 'Solo una columna'
    ELSE 'Sin peso'
  END as estado
FROM products
WHERE is_active = TRUE
AND (peso_kg > 0 OR peso_g > 0)
ORDER BY nombre
LIMIT 20;

-- =============================================================================
-- PASO 5: ESTADÍSTICAS FINALES
-- =============================================================================

SELECT 
  COUNT(*) as total_productos_activos,
  COUNT(CASE WHEN peso_kg > 0 THEN 1 END) as productos_con_peso_kg,
  COUNT(CASE WHEN peso_g > 0 THEN 1 END) as productos_con_peso_g,
  COUNT(CASE WHEN peso_kg > 0 AND peso_g > 0 THEN 1 END) as productos_con_ambos,
  COUNT(CASE WHEN (peso_kg IS NULL OR peso_kg = 0) AND (peso_g IS NULL OR peso_g = 0) THEN 1 END) as productos_sin_peso,
  ROUND(AVG(peso_kg), 3) as peso_promedio_kg,
  ROUND(AVG(peso_g), 1) as peso_promedio_g
FROM products
WHERE is_active = TRUE;

-- =============================================================================
-- PASO 6: ANÁLISIS DE COLUMNAS DUPLICADAS
-- =============================================================================

-- Ver si weight_kg y weight_g tienen uso real
SELECT 
  'Análisis: ¿Debemos eliminar weight_kg y weight_g?' as pregunta,
  COUNT(CASE WHEN weight_kg > 0 AND peso_kg = 0 THEN 1 END) as solo_weight_kg_tiene_datos,
  COUNT(CASE WHEN weight_g > 0 AND peso_g = 0 THEN 1 END) as solo_weight_g_tiene_datos,
  COUNT(CASE WHEN weight_kg > 0 AND peso_kg > 0 AND ABS(weight_kg - peso_kg) > 0.01 THEN 1 END) as valores_diferentes_kg,
  COUNT(CASE WHEN weight_g > 0 AND peso_g > 0 AND ABS(weight_g - peso_g) > 0.01 THEN 1 END) as valores_diferentes_g,
  CASE 
    WHEN COUNT(CASE WHEN weight_kg > 0 AND peso_kg = 0 THEN 1 END) = 0 
     AND COUNT(CASE WHEN weight_g > 0 AND peso_g = 0 THEN 1 END) = 0
    THEN 'SEGURO: Podemos eliminar weight_kg y weight_g'
    ELSE 'PRECAUCION: Algunas columnas weight_* tienen datos unicos'
  END as recomendacion
FROM products
WHERE is_active = TRUE;

-- =============================================================================
-- PASO 7: SCRIPT PARA ELIMINAR COLUMNAS DUPLICADAS (COMENTADO)
-- Ejecutar solo si el Paso 6 muestra que es seguro
-- =============================================================================

/*
-- ADVERTENCIA: Solo ejecutar si el análisis del Paso 6 confirma que es seguro

-- Eliminar columnas weight_kg y weight_g si no se usan
ALTER TABLE products DROP COLUMN IF EXISTS weight_kg;
ALTER TABLE products DROP COLUMN IF EXISTS weight_g;

-- Verificar columnas restantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name LIKE '%weight%' OR column_name LIKE '%peso%'
ORDER BY column_name;
*/

-- =============================================================================
-- RESUMEN DE CAMBIOS
-- =============================================================================

SELECT 
  'Paso 1: Diagnostico completado' as paso_1,
  'Paso 2: Ejemplos mostrados' as paso_2,
  'Paso 3: Sincronizacion ejecutada (peso_g y peso_kg)' as paso_3,
  'Paso 4: Verificacion completada' as paso_4,
  'Paso 5: Estadisticas generadas' as paso_5,
  'Paso 6: Analisis de duplicados' as paso_6,
  'Paso 7: Eliminacion de columnas (revisar antes de ejecutar)' as paso_7;
