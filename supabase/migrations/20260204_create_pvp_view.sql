-- Migración: Crear vista v_product_max_pvp
-- Fecha: 2026-02-04
-- Propósito: Vista agregada de PVPs (precios de venta) de otros sellers por producto
-- Autor: Sistema
-- Fase: FASE 1 - Tarea 1.2
-- Uso: Para calcular PVP sugerido basado en precios de mercado

-- =====================================================
-- 1. ELIMINAR VISTA EXISTENTE (si existe)
-- =====================================================

DROP VIEW IF EXISTS v_product_max_pvp;

-- =====================================================
-- 2. CREAR VISTA v_product_max_pvp
-- =====================================================

CREATE OR REPLACE VIEW v_product_max_pvp AS
SELECT 
  sc.source_product_id as product_id,
  
  -- Precio máximo (más alto) de venta entre sellers activos
  MAX(sc.precio_venta) as max_pvp,
  
  -- Precio mínimo (más bajo) de venta entre sellers activos
  MIN(sc.precio_venta) as min_pvp,
  
  -- Precio promedio de venta
  AVG(sc.precio_venta) as avg_pvp,
  
  -- Precio mediano (más representativo del mercado)
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sc.precio_venta) as median_pvp,
  
  -- Cantidad de sellers que venden este producto
  COUNT(DISTINCT sc.seller_store_id) as seller_count,
  
  -- Cantidad total de variaciones en venta
  COUNT(*) as total_listings,
  
  -- Rango de precios (diferencia entre max y min)
  MAX(sc.precio_venta) - MIN(sc.precio_venta) as price_range,
  
  -- Desviación estándar (indica dispersión de precios)
  STDDEV(sc.precio_venta) as price_stddev,
  
  -- Último seller que actualizó precio
  MAX(sc.updated_at) as last_price_update

FROM seller_catalog sc

WHERE 
  -- Solo productos activos en catálogos de sellers
  sc.is_active = TRUE
  
  -- Solo precios válidos (mayores a 0)
  AND sc.precio_venta > 0
  
  -- Excluir sellers inactivos o suspendidos (si aplica)
  -- AND sc.seller_store_id IN (SELECT id FROM seller_stores WHERE is_active = TRUE)

GROUP BY sc.source_product_id

-- Opcional: Solo productos con al menos 2 sellers (para tener comparación)
-- HAVING COUNT(DISTINCT sc.seller_store_id) >= 2
;

-- =====================================================
-- 3. AGREGAR COMENTARIOS A LA VISTA
-- =====================================================

COMMENT ON VIEW v_product_max_pvp IS 
  'Vista agregada de precios de venta (PVP) por producto entre sellers activos. Usada para calcular PVP sugerido basado en precios de mercado.';

-- =====================================================
-- 4. CREAR ÍNDICES EN TABLA BASE (si no existen)
-- =====================================================

-- Índice en source_product_id para joins rápidos
CREATE INDEX IF NOT EXISTS idx_seller_catalog_source_product_id 
ON seller_catalog(source_product_id) 
WHERE is_active = TRUE;

-- Índice en seller_store_id para agregaciones
CREATE INDEX IF NOT EXISTS idx_seller_catalog_seller_store_id 
ON seller_catalog(seller_store_id) 
WHERE is_active = TRUE;

-- Índice compuesto para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_seller_catalog_product_active 
ON seller_catalog(source_product_id, is_active, precio_venta);

-- =====================================================
-- 5. PERMISOS RLS (Row Level Security)
-- =====================================================

-- Si la tabla seller_catalog tiene RLS habilitado, 
-- asegurar que la vista respete las políticas

-- Verificar si RLS está habilitado
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'seller_catalog';

-- Si necesitas dar permisos específicos a roles:
-- GRANT SELECT ON v_product_max_pvp TO authenticated;
-- GRANT SELECT ON v_product_max_pvp TO anon;

-- =====================================================
-- 6. QUERIES DE VERIFICACIÓN
-- =====================================================

-- Query 1: Ver productos con más competencia (más sellers)
-- SELECT 
--   p.id,
--   p.nombre,
--   v.seller_count as num_sellers,
--   v.min_pvp,
--   v.avg_pvp,
--   v.max_pvp,
--   v.price_range,
--   ROUND((v.price_range / v.avg_pvp * 100)::numeric, 2) as variacion_porcentaje
-- FROM v_product_max_pvp v
-- JOIN products p ON p.id = v.product_id
-- ORDER BY v.seller_count DESC
-- LIMIT 20;

-- Query 2: Ver productos con mayor dispersión de precios
-- SELECT 
--   p.id,
--   p.nombre,
--   v.seller_count,
--   v.avg_pvp,
--   v.price_stddev,
--   ROUND((v.price_stddev / v.avg_pvp * 100)::numeric, 2) as coeficiente_variacion
-- FROM v_product_max_pvp v
-- JOIN products p ON p.id = v.product_id
-- WHERE v.seller_count >= 3
-- ORDER BY (v.price_stddev / v.avg_pvp) DESC
-- LIMIT 20;

-- Query 3: Comparar precio_b2b vs PVPs de mercado
-- SELECT 
--   p.id,
--   p.nombre,
--   vb2b.precio_b2b,
--   pvp.avg_pvp,
--   pvp.max_pvp,
--   ROUND(((pvp.avg_pvp - vb2b.precio_b2b) / vb2b.precio_b2b * 100)::numeric, 2) as margen_promedio_porcentaje,
--   pvp.seller_count
-- FROM products p
-- JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
-- LEFT JOIN v_product_max_pvp pvp ON pvp.product_id = p.id
-- WHERE pvp.seller_count IS NOT NULL
-- ORDER BY margen_promedio_porcentaje DESC
-- LIMIT 20;

-- =====================================================
-- 7. FUNCIÓN DE ANÁLISIS DE MERCADO (BONUS)
-- =====================================================

-- Función para obtener análisis detallado de un producto
CREATE OR REPLACE FUNCTION get_product_market_analysis(p_product_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  precio_b2b NUMERIC,
  suggested_pvp_by_market NUMERIC,
  min_market_pvp NUMERIC,
  avg_market_pvp NUMERIC,
  max_market_pvp NUMERIC,
  num_competitors INT,
  price_dispersion NUMERIC,
  recommended_pvp NUMERIC,
  expected_margin_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.nombre as product_name,
    vb2b.precio_b2b,
    pvp.max_pvp as suggested_pvp_by_market,
    pvp.min_pvp as min_market_pvp,
    pvp.avg_pvp as avg_market_pvp,
    pvp.max_pvp as max_market_pvp,
    pvp.seller_count::INT as num_competitors,
    pvp.price_stddev as price_dispersion,
    -- PVP recomendado: si hay mercado, usar max, sino usar markup categoría
    COALESCE(
      pvp.max_pvp,
      vb2b.precio_b2b * COALESCE(c.default_markup_multiplier, 4.0)
    ) as recommended_pvp,
    -- Margen esperado en porcentaje
    ROUND(
      ((COALESCE(pvp.max_pvp, vb2b.precio_b2b * 4.0) - vb2b.precio_b2b) 
      / vb2b.precio_b2b * 100)::numeric, 
      2
    ) as expected_margin_pct
  FROM products p
  JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
  LEFT JOIN v_product_max_pvp pvp ON pvp.product_id = p.id
  LEFT JOIN categories c ON c.id = p.categoria_id
  WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_product_market_analysis IS 
  'Retorna análisis completo de mercado para un producto: precios B2B, PVPs de competidores, PVP recomendado y margen esperado';

-- =====================================================
-- ROLLBACK (si es necesario)
-- =====================================================

-- Para revertir esta migración, ejecutar:
-- DROP VIEW IF EXISTS v_product_max_pvp;
-- DROP FUNCTION IF EXISTS get_product_market_analysis;
-- DROP INDEX IF EXISTS idx_seller_catalog_source_product_id;
-- DROP INDEX IF EXISTS idx_seller_catalog_seller_store_id;
-- DROP INDEX IF EXISTS idx_seller_catalog_product_active;
