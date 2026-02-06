-- ============================================
-- FASE 1.4: Migración de datos existentes
-- Fecha: 2026-02-05
-- Objetivo: Actualizar seller_catalog con precios correctos
-- ============================================

-- ============================================
-- PARTE 1: Actualizar precio_costo en seller_catalog
-- ============================================

-- Los sellers deben PAGAR el precio_b2b (con márgenes), 
-- NO el precio_mayorista_base (sin márgenes)

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Actualizar precio_costo usando vista con precios correctos
  WITH updates AS (
    UPDATE public.seller_catalog sc
    SET 
      precio_costo = vp.precio_b2b,
      updated_at = NOW()
    FROM public.v_productos_con_precio_b2b vp
    WHERE sc.source_product_id = vp.id
      AND (sc.precio_costo IS NULL 
           OR sc.precio_costo != vp.precio_b2b
           OR ABS(sc.precio_costo - vp.precio_b2b) > 0.01)
    RETURNING sc.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;
  
  RAISE NOTICE '✅ Actualizados % registros en seller_catalog.precio_costo', v_updated_count;
  
EXCEPTION WHEN OTHERS THEN
  v_error_count := 1;
  RAISE NOTICE '❌ Error al actualizar precio_costo: %', SQLERRM;
END $$;

-- ============================================
-- PARTE 2: Recalcular precio_venta (PVP) para productos sin configurar
-- ============================================

-- Solo actualizar productos donde el seller NO ha configurado un PVP específico
-- (identificamos esto si precio_venta es muy similar a precio_mayorista_base)

DO $$
DECLARE
  v_updated_pvp_count INTEGER := 0;
BEGIN
  -- Actualizar PVP solo si parece que no fue configurado manualmente
  WITH updates AS (
    UPDATE public.seller_catalog sc
    SET 
      precio_venta = public.calculate_suggested_pvp(sc.source_product_id),
      updated_at = NOW()
    FROM public.products p
    WHERE sc.source_product_id = p.id
      AND (
        -- Caso 1: PVP nunca fue configurado (es NULL o 0)
        sc.precio_venta IS NULL 
        OR sc.precio_venta = 0
        -- Caso 2: PVP parece ser el precio_mayorista (no fue ajustado manualmente)
        OR ABS(sc.precio_venta - p.precio_mayorista_base) < 0.01
      )
    RETURNING sc.id
  )
  SELECT COUNT(*) INTO v_updated_pvp_count FROM updates;
  
  RAISE NOTICE '✅ Actualizados % registros en seller_catalog.precio_venta', v_updated_pvp_count;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error al actualizar precio_venta: %', SQLERRM;
END $$;

-- ============================================
-- PARTE 3: Auditoría de cambios
-- ============================================

-- Ver resumen de productos actualizados
SELECT 
  'seller_catalog' as tabla,
  COUNT(*) as total_productos,
  COUNT(DISTINCT seller_store_id) as total_sellers,
  ROUND(AVG(precio_costo)::numeric, 2) as precio_costo_promedio,
  ROUND(AVG(precio_venta)::numeric, 2) as precio_venta_promedio,
  ROUND(AVG((precio_venta - precio_costo) / NULLIF(precio_costo, 0) * 100)::numeric, 2) as margen_promedio_percent
FROM public.seller_catalog
WHERE is_active = TRUE 
  AND precio_costo > 0 
  AND precio_venta > 0;

-- Ver productos con margen muy bajo (posible error)
SELECT 
  p.nombre,
  p.sku_interno,
  sc.precio_costo as "Costo B2B",
  sc.precio_venta as "PVP",
  ROUND((sc.precio_venta - sc.precio_costo)::numeric, 2) as "Ganancia",
  ROUND(((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as "Margen %"
FROM public.seller_catalog sc
JOIN public.products p ON p.id = sc.source_product_id
WHERE sc.is_active = TRUE
  AND sc.precio_venta > 0
  AND sc.precio_costo > 0
  AND ((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100) < 50
ORDER BY ((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100) ASC
LIMIT 20;

-- Ver productos con margen muy alto (verificar si es intencional)
SELECT 
  p.nombre,
  p.sku_interno,
  sc.precio_costo as "Costo B2B",
  sc.precio_venta as "PVP",
  ROUND((sc.precio_venta - sc.precio_costo)::numeric, 2) as "Ganancia",
  ROUND(((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100)::numeric, 2) as "Margen %"
FROM public.seller_catalog sc
JOIN public.products p ON p.id = sc.source_product_id
WHERE sc.is_active = TRUE
  AND sc.precio_venta > 0
  AND sc.precio_costo > 0
  AND ((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100) > 500
ORDER BY ((sc.precio_venta - sc.precio_costo) / NULLIF(sc.precio_costo, 0) * 100) DESC
LIMIT 20;

-- ============================================
-- Índices para mejorar performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_seller_catalog_prices 
ON public.seller_catalog(source_product_id, precio_costo, precio_venta) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_seller_catalog_seller_product 
ON public.seller_catalog(seller_store_id, source_product_id) 
WHERE is_active = TRUE;
