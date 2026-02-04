-- Migración: Actualizar precios existentes en seller_catalog
-- Fecha: 2026-02-04
-- Propósito: Corregir precio_costo de productos ya importados para usar precio_b2b correcto
-- Autor: Sistema
-- Fase: FASE 1 - Tarea 1.4
-- IMPORTANTE: Esta migración actualiza datos existentes. Hacer backup antes de ejecutar.

-- =====================================================
-- 0. INFORMACIÓN PREVIA
-- =====================================================

-- Esta migración corrige registros en seller_catalog donde:
-- - precio_costo está basado en precio_mayorista_base (incorrecto)
-- - Debe actualizarse a precio_b2b de la vista (correcto con márgenes)

-- Verificar cuántos registros serán afectados:
-- SELECT COUNT(*) 
-- FROM seller_catalog sc
-- JOIN v_productos_con_precio_b2b vp ON sc.product_id = vp.id
-- WHERE sc.precio_costo != vp.precio_b2b;

-- =====================================================
-- 1. CREAR TABLA DE BACKUP
-- =====================================================

-- Crear tabla temporal con backup de datos originales
CREATE TABLE IF NOT EXISTS seller_catalog_backup_20260204 AS
SELECT 
  id,
  seller_store_id,
  source_product_id,
  precio_costo as precio_costo_original,
  precio_venta as precio_venta_original,
  created_at,
  updated_at,
  NOW() as backup_timestamp
FROM seller_catalog;

COMMENT ON TABLE seller_catalog_backup_20260204 IS 
  'Backup de seller_catalog antes de migración de precios 2026-02-04. No eliminar hasta verificar que migración fue exitosa.';

-- =====================================================
-- 2. ANÁLISIS PRE-MIGRACIÓN
-- =====================================================

-- Crear tabla con análisis de diferencias
CREATE TEMP TABLE migration_analysis AS
SELECT 
  sc.id as catalog_id,
  sc.seller_store_id,
  sc.source_product_id,
  p.nombre as product_name,
  p.sku_interno,
  
  -- Precios actuales (incorrectos)
  sc.precio_costo as precio_costo_actual,
  sc.precio_venta as precio_venta_actual,
  
  -- Precios correctos (de vista)
  vp.precio_b2b as precio_b2b_correcto,
  
  -- Diferencias
  (vp.precio_b2b - sc.precio_costo) as diferencia_costo,
  ROUND(((vp.precio_b2b - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as diferencia_costo_pct,
  
  -- Margen actual (puede ser incorrecto)
  ROUND(((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as margen_actual_pct,
  
  -- Margen correcto (después de migración)
  ROUND(((sc.precio_venta - vp.precio_b2b) / NULLIF(vp.precio_b2b, 0) * 100)::numeric, 2) as margen_correcto_pct,
  
  -- Flags de validación
  CASE 
    WHEN ABS(vp.precio_b2b - sc.precio_costo) < 0.01 THEN 'OK'
    WHEN vp.precio_b2b > sc.precio_costo THEN 'AUMENTAR_COSTO'
    ELSE 'DISMINUIR_COSTO'
  END as accion_necesaria,
  
  CASE 
    WHEN sc.precio_venta < vp.precio_b2b THEN 'ALERTA_MARGEN_NEGATIVO'
    ELSE 'OK'
  END as alerta_margen

FROM seller_catalog sc
JOIN products p ON p.id = sc.source_product_id
JOIN v_productos_con_precio_b2b vp ON vp.id = sc.source_product_id
WHERE sc.is_active = TRUE;

-- =====================================================
-- 3. REPORTE DE ANÁLISIS
-- =====================================================

-- Mostrar resumen de migración
DO $$
DECLARE
  v_total_records INT;
  v_records_to_update INT;
  v_records_with_negative_margin INT;
  v_avg_price_diff NUMERIC;
  v_max_price_diff NUMERIC;
BEGIN
  -- Contar registros
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE accion_necesaria != 'OK'),
    COUNT(*) FILTER (WHERE alerta_margen = 'ALERTA_MARGEN_NEGATIVO'),
    AVG(ABS(diferencia_costo)),
    MAX(ABS(diferencia_costo))
  INTO 
    v_total_records,
    v_records_to_update,
    v_records_with_negative_margin,
    v_avg_price_diff,
    v_max_price_diff
  FROM migration_analysis;
  
  -- Mostrar reporte
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ANÁLISIS DE MIGRACIÓN DE PRECIOS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de registros en seller_catalog: %', v_total_records;
  RAISE NOTICE 'Registros que necesitan actualización: %', v_records_to_update;
  RAISE NOTICE 'Registros con margen negativo después: %', v_records_with_negative_margin;
  RAISE NOTICE 'Diferencia promedio de precio: $%.2f', v_avg_price_diff;
  RAISE NOTICE 'Diferencia máxima de precio: $%.2f', v_max_price_diff;
  RAISE NOTICE '============================================';
  
  -- Advertencia si hay márgenes negativos
  IF v_records_with_negative_margin > 0 THEN
    RAISE WARNING '¡ATENCIÓN! % productos tendrán margen NEGATIVO después de la migración', v_records_with_negative_margin;
    RAISE WARNING 'Revisar tabla migration_analysis antes de continuar';
  END IF;
END $$;

-- =====================================================
-- 4. ACTUALIZAR precio_costo EN seller_catalog
-- =====================================================

-- Actualizar precio_costo con el precio_b2b correcto de la vista
UPDATE seller_catalog sc
SET 
  precio_costo = vp.precio_b2b,
  updated_at = NOW()
FROM v_productos_con_precio_b2b vp
WHERE 
  sc.source_product_id = vp.id
  AND sc.is_active = TRUE
  -- Solo actualizar si hay diferencia (evitar updates innecesarios)
  AND ABS(sc.precio_costo - vp.precio_b2b) >= 0.01;

-- Obtener cantidad de registros actualizados
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Actualización completada: % registros actualizados', v_updated_count;
END $$;

-- =====================================================
-- 5. IDENTIFICAR PRODUCTOS CON MARGEN NEGATIVO
-- =====================================================

-- Crear tabla con productos que necesitan atención
CREATE TEMP TABLE productos_margen_negativo AS
SELECT 
  sc.id as catalog_id,
  sc.seller_store_id,
  p.nombre as product_name,
  p.sku_interno,
  sc.precio_costo as costo_b2b,
  sc.precio_venta as pvp_actual,
  (sc.precio_venta - sc.precio_costo) as margen_absoluto,
  ROUND(((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as margen_porcentaje,
  calculate_suggested_pvp(p.id) as pvp_sugerido
FROM seller_catalog sc
JOIN products p ON p.id = sc.source_product_id
WHERE 
  sc.is_active = TRUE
  AND sc.precio_venta < sc.precio_costo;

-- Mostrar alerta si hay productos con margen negativo
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM productos_margen_negativo;
  
  IF v_count > 0 THEN
    RAISE WARNING '⚠️  % productos tienen margen NEGATIVO (precio_venta < precio_costo)', v_count;
    RAISE WARNING 'Ejecutar: SELECT * FROM productos_margen_negativo ORDER BY margen_porcentaje;';
  ELSE
    RAISE NOTICE '✅ No hay productos con margen negativo';
  END IF;
END $$;

-- =====================================================
-- 6. SUGERIR ACTUALIZACIÓN DE precio_venta (OPCIONAL)
-- =====================================================

-- Crear tabla con sugerencias de nuevos PVPs
CREATE TEMP TABLE pvp_suggestions AS
SELECT 
  sc.id as catalog_id,
  sc.seller_store_id,
  p.nombre as product_name,
  sc.precio_costo as costo_actual,
  sc.precio_venta as pvp_actual,
  calculate_suggested_pvp(p.id) as pvp_sugerido,
  -- Sugerir PVP basado en:
  -- 1. PVP sugerido calculado
  -- 2. Mínimo: costo × 1.5 (50% margen)
  GREATEST(
    calculate_suggested_pvp(p.id),
    sc.precio_costo * 1.5
  ) as pvp_recomendado,
  ROUND(
    ((GREATEST(calculate_suggested_pvp(p.id), sc.precio_costo * 1.5) - sc.precio_costo) 
    / NULLIF(sc.precio_costo, 0) * 100)::numeric, 
    2
  ) as margen_recomendado_pct
FROM seller_catalog sc
JOIN products p ON p.id = sc.source_product_id
WHERE 
  sc.is_active = TRUE
  AND sc.precio_venta < sc.precio_costo;

-- Mostrar reporte de sugerencias
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pvp_suggestions;
  
  IF v_count > 0 THEN
    RAISE NOTICE '💡 Hay % productos con PVP sugerido disponible', v_count;
    RAISE NOTICE 'Ejecutar: SELECT * FROM pvp_suggestions ORDER BY margen_recomendado_pct;';
  END IF;
END $$;

-- =====================================================
-- 7. QUERY PARA ACTUALIZAR PVPs (COMENTADO - EJECUTAR MANUALMENTE)
-- =====================================================

-- IMPORTANTE: Esta query actualiza precio_venta automáticamente
-- Solo descomentar y ejecutar si estás seguro

/*
UPDATE seller_catalog sc
SET 
  precio_venta = ps.pvp_recomendado,
  updated_at = NOW()
FROM pvp_suggestions ps
WHERE sc.id = ps.catalog_id;

-- Notificar a sellers afectados (implementar notificación externa)
-- RAISE NOTICE 'PVPs actualizados. Notificar a sellers de los cambios.';
*/

-- =====================================================
-- 8. CREAR VISTA DE REPORTE
-- =====================================================

-- Vista permanente para monitorear precios después de migración
CREATE OR REPLACE VIEW v_seller_catalog_pricing_report AS
SELECT 
  s.name as store_name,
  sc.seller_store_id,
  p.id as product_id,
  p.nombre as product_name,
  p.sku_interno,
  
  -- Precios actuales
  sc.precio_costo,
  sc.precio_venta,
  vp.precio_b2b,
  
  -- PVP sugerido
  calculate_suggested_pvp(p.id) as pvp_sugerido,
  
  -- Márgenes
  ROUND(((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as margen_actual_pct,
  (sc.precio_venta - sc.precio_costo) as margen_absoluto,
  
  -- Validaciones
  CASE 
    WHEN ABS(sc.precio_costo - vp.precio_b2b) >= 0.01 THEN '⚠️ PRECIO_COSTO_DESACTUALIZADO'
    ELSE '✅ OK'
  END as status_precio_costo,
  
  CASE 
    WHEN sc.precio_venta < sc.precio_costo THEN '🔴 MARGEN_NEGATIVO'
    WHEN (sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) < 0.2 THEN '🟡 MARGEN_BAJO'
    ELSE '✅ OK'
  END as status_margen,
  
  -- Timestamps
  sc.updated_at as last_price_update

FROM seller_catalog sc
JOIN products p ON p.id = sc.source_product_id
JOIN v_productos_con_precio_b2b vp ON vp.id = p.id
LEFT JOIN stores s ON s.id = sc.seller_store_id
WHERE sc.is_active = TRUE;

COMMENT ON VIEW v_seller_catalog_pricing_report IS 
  'Reporte de precios en seller_catalog con validaciones y alertas. Usar para monitorear precios después de migración.';

-- =====================================================
-- 9. VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Query de verificación (ejecutar después de migración)
DO $$
DECLARE
  v_total INT;
  v_ok INT;
  v_desactualizados INT;
  v_margen_negativo INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status_precio_costo = '✅ OK'),
    COUNT(*) FILTER (WHERE status_precio_costo LIKE '%DESACTUALIZADO%'),
    COUNT(*) FILTER (WHERE status_margen LIKE '%NEGATIVO%')
  INTO 
    v_total,
    v_ok,
    v_desactualizados,
    v_margen_negativo
  FROM v_seller_catalog_pricing_report;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'VERIFICACIÓN POST-MIGRACIÓN';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de productos en catálogos: %', v_total;
  RAISE NOTICE 'Productos con precio_costo OK: %', v_ok;
  RAISE NOTICE 'Productos con precio_costo desactualizado: %', v_desactualizados;
  RAISE NOTICE 'Productos con margen negativo: %', v_margen_negativo;
  RAISE NOTICE '============================================';
  
  IF v_desactualizados = 0 THEN
    RAISE NOTICE '✅ MIGRACIÓN EXITOSA - Todos los precios están correctos';
  ELSE
    RAISE WARNING '⚠️  Hay % productos con precios desactualizados', v_desactualizados;
  END IF;
END $$;

-- =====================================================
-- 10. LIMPIEZA (OPCIONAL - Ejecutar después de verificar)
-- =====================================================

-- Una vez verificado que la migración fue exitosa:
-- DROP TABLE IF EXISTS seller_catalog_backup_20260204;
-- DROP TABLE IF EXISTS migration_analysis;
-- DROP TABLE IF EXISTS productos_margen_negativo;
-- DROP TABLE IF EXISTS pvp_suggestions;

-- =====================================================
-- ROLLBACK (si es necesario)
-- =====================================================

-- Para revertir esta migración (restaurar desde backup):
/*
UPDATE seller_catalog sc
SET 
  precio_costo = b.precio_costo_original,
  precio_venta = b.precio_venta_original,
  updated_at = NOW()
FROM seller_catalog_backup_20260204 b
WHERE sc.id = b.id;

RAISE NOTICE 'Migración revertida desde backup';
*/
