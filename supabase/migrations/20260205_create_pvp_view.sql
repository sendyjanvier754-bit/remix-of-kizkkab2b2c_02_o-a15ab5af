-- ============================================
-- FASE 1.2: Vista de PVPs de otros sellers
-- Fecha: 2026-02-05
-- Objetivo: Agregar visibilidad de precios de mercado
-- ============================================

-- Eliminar vista si existe
DROP VIEW IF EXISTS public.v_product_max_pvp CASCADE;

-- Crear vista con estadísticas de PVPs por producto
CREATE VIEW public.v_product_max_pvp AS
SELECT 
  sc.source_product_id as product_id,
  MAX(sc.precio_venta) as max_pvp,
  MIN(sc.precio_venta) as min_pvp,
  ROUND(AVG(sc.precio_venta)::numeric, 2) as avg_pvp,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sc.precio_venta)::numeric, 2) as median_pvp,
  COUNT(DISTINCT sc.seller_store_id) as seller_count,
  COUNT(*) as total_listings,
  -- Calcular spread del mercado
  ROUND(((MAX(sc.precio_venta) - MIN(sc.precio_venta)) / NULLIF(MIN(sc.precio_venta), 0) * 100)::numeric, 2) as price_spread_percent
FROM public.seller_catalog sc
WHERE sc.is_active = TRUE 
  AND sc.precio_venta > 0
GROUP BY sc.source_product_id;

-- Comentario
COMMENT ON VIEW public.v_product_max_pvp IS 
'Vista que muestra estadísticas de PVPs configurados por otros sellers para cada producto. Útil para: 1) Sugerir PVP competitivo, 2) Análisis de mercado, 3) Detectar oportunidades de precio.';

-- Crear índice en tabla base para mejorar performance
CREATE INDEX IF NOT EXISTS idx_seller_catalog_active_price 
ON public.seller_catalog(source_product_id, precio_venta) 
WHERE is_active = TRUE AND precio_venta > 0;

-- ============================================
-- Query de verificación
-- ============================================

-- Ver productos con más competencia
SELECT 
  p.nombre,
  p.sku_interno,
  v.seller_count as "Sellers",
  v.min_pvp as "PVP Mínimo",
  v.avg_pvp as "PVP Promedio",
  v.max_pvp as "PVP Máximo",
  v.price_spread_percent as "Spread %"
FROM v_product_max_pvp v
JOIN products p ON p.id = v.product_id
WHERE v.seller_count > 1
ORDER BY v.seller_count DESC, v.avg_pvp DESC
LIMIT 10;
