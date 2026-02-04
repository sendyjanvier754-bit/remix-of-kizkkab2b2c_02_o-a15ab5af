-- Migración: Crear función calculate_suggested_pvp
-- Fecha: 2026-02-04
-- Propósito: Función para calcular PVP (Precio de Venta al Público) sugerido para sellers
-- Autor: Sistema
-- Fase: FASE 1 - Tarea 1.3
-- Lógica de Prioridad:
--   1. Si existe precio_sugerido_venta del admin → usar ese
--   2. Si no, buscar MAX PVP de otros sellers → usar ese
--   3. Si no hay otros sellers, calcular con margen de categoría → precio_b2b × markup
--   4. Fallback: precio_b2b × 4

-- =====================================================
-- 1. ELIMINAR FUNCIÓN EXISTENTE (si existe)
-- =====================================================

DROP FUNCTION IF EXISTS calculate_suggested_pvp(UUID, UUID);
DROP FUNCTION IF EXISTS calculate_suggested_pvp(UUID);

-- =====================================================
-- 2. CREAR FUNCIÓN calculate_suggested_pvp
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_suggested_pvp(
  p_product_id UUID,
  p_market_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_precio_sugerido NUMERIC;
  v_precio_b2b NUMERIC;
  v_max_pvp NUMERIC;
  v_markup_multiplier NUMERIC;
  v_calculated_pvp NUMERIC;
BEGIN
  
  -- =====================================================
  -- PRIORIDAD 1: Precio Sugerido por Admin
  -- =====================================================
  
  -- Buscar si el admin configuró un precio_sugerido_venta
  SELECT precio_sugerido_venta 
  INTO v_precio_sugerido
  FROM products 
  WHERE id = p_product_id;
  
  -- Si existe y es válido (mayor a 0), retornar ese
  IF v_precio_sugerido IS NOT NULL AND v_precio_sugerido > 0 THEN
    RETURN ROUND(v_precio_sugerido, 2);
  END IF;
  
  -- =====================================================
  -- PRIORIDAD 2: PVP Máximo de Otros Sellers
  -- =====================================================
  
  -- Buscar el PVP más alto de otros sellers para este producto
  SELECT max_pvp 
  INTO v_max_pvp
  FROM v_product_max_pvp 
  WHERE product_id = p_product_id;
  
  -- Si hay otros sellers vendiendo y el precio es válido, usar ese
  IF v_max_pvp IS NOT NULL AND v_max_pvp > 0 THEN
    RETURN ROUND(v_max_pvp, 2);
  END IF;
  
  -- =====================================================
  -- PRIORIDAD 3: Calcular con Margen de Categoría
  -- =====================================================
  
  -- Obtener precio_b2b y markup de categoría
  SELECT 
    vp.precio_b2b, 
    c.default_markup_multiplier
  INTO 
    v_precio_b2b, 
    v_markup_multiplier
  FROM v_productos_con_precio_b2b vp
  JOIN products p ON p.id = vp.id
  LEFT JOIN categories c ON c.id = p.categoria_id
  WHERE vp.id = p_product_id;
  
  -- Si tenemos precio_b2b y markup de categoría, calcular
  IF v_precio_b2b IS NOT NULL AND v_precio_b2b > 0 THEN
    
    -- Si existe markup de categoría, usar ese
    IF v_markup_multiplier IS NOT NULL AND v_markup_multiplier > 0 THEN
      v_calculated_pvp := v_precio_b2b * v_markup_multiplier;
    ELSE
      -- Fallback: usar 4x (400% markup)
      v_calculated_pvp := v_precio_b2b * 4.0;
    END IF;
    
    RETURN ROUND(v_calculated_pvp, 2);
  END IF;
  
  -- =====================================================
  -- FALLBACK FINAL: Retornar 0 si no hay datos
  -- =====================================================
  
  -- Si llegamos aquí, no pudimos calcular el PVP
  -- Retornar 0 para indicar que no hay precio sugerido
  RETURN 0;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, retornar 0 y registrar en logs
    RAISE WARNING 'Error calculando PVP sugerido para producto %: %', p_product_id, SQLERRM;
    RETURN 0;
    
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 3. AGREGAR COMENTARIOS A LA FUNCIÓN
-- =====================================================

COMMENT ON FUNCTION calculate_suggested_pvp IS 
  'Calcula PVP (Precio de Venta) sugerido para un producto. Prioridad: 1) precio_sugerido_venta admin, 2) MAX PVP de otros sellers, 3) precio_b2b × markup categoría, 4) precio_b2b × 4';

-- =====================================================
-- 4. CREAR FUNCIÓN CON DETALLES (para debugging)
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_suggested_pvp_with_details(
  p_product_id UUID,
  p_market_id UUID DEFAULT NULL
)
RETURNS TABLE (
  suggested_pvp NUMERIC,
  source TEXT,
  precio_admin NUMERIC,
  max_pvp_market NUMERIC,
  precio_b2b NUMERIC,
  markup_multiplier NUMERIC,
  calculated_value NUMERIC,
  explanation TEXT
) AS $$
DECLARE
  v_precio_sugerido NUMERIC;
  v_precio_b2b NUMERIC;
  v_max_pvp NUMERIC;
  v_markup_multiplier NUMERIC;
  v_calculated_pvp NUMERIC;
  v_final_pvp NUMERIC;
  v_source TEXT;
  v_explanation TEXT;
BEGIN
  
  -- Obtener precio_sugerido_venta del admin
  SELECT precio_sugerido_venta 
  INTO v_precio_sugerido
  FROM products 
  WHERE id = p_product_id;
  
  -- Obtener MAX PVP de otros sellers
  SELECT max_pvp 
  INTO v_max_pvp
  FROM v_product_max_pvp 
  WHERE product_id = p_product_id;
  
  -- Obtener precio_b2b y markup
  SELECT 
    vp.precio_b2b, 
    c.default_markup_multiplier
  INTO 
    v_precio_b2b, 
    v_markup_multiplier
  FROM v_productos_con_precio_b2b vp
  JOIN products p ON p.id = vp.id
  LEFT JOIN categories c ON c.id = p.categoria_id
  WHERE vp.id = p_product_id;
  
  -- Determinar fuente y calcular PVP final
  IF v_precio_sugerido IS NOT NULL AND v_precio_sugerido > 0 THEN
    v_final_pvp := v_precio_sugerido;
    v_source := 'admin_configured';
    v_explanation := 'Precio sugerido configurado por administrador';
    
  ELSIF v_max_pvp IS NOT NULL AND v_max_pvp > 0 THEN
    v_final_pvp := v_max_pvp;
    v_source := 'market_max';
    v_explanation := 'PVP más alto del mercado (otros sellers)';
    
  ELSIF v_precio_b2b IS NOT NULL AND v_precio_b2b > 0 THEN
    v_calculated_pvp := v_precio_b2b * COALESCE(v_markup_multiplier, 4.0);
    v_final_pvp := v_calculated_pvp;
    v_source := 'calculated';
    v_explanation := FORMAT(
      'Calculado: precio_b2b (%.2f) × markup (%.2f)',
      v_precio_b2b,
      COALESCE(v_markup_multiplier, 4.0)
    );
    
  ELSE
    v_final_pvp := 0;
    v_source := 'no_data';
    v_explanation := 'No hay datos suficientes para calcular PVP';
  END IF;
  
  -- Retornar resultado con detalles
  RETURN QUERY SELECT
    ROUND(v_final_pvp, 2) as suggested_pvp,
    v_source as source,
    v_precio_sugerido as precio_admin,
    v_max_pvp as max_pvp_market,
    v_precio_b2b as precio_b2b,
    v_markup_multiplier as markup_multiplier,
    v_calculated_pvp as calculated_value,
    v_explanation as explanation;
    
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_suggested_pvp_with_details IS 
  'Versión extendida de calculate_suggested_pvp que retorna detalles del cálculo para debugging y análisis';

-- =====================================================
-- 5. CREAR VISTA MATERIALIZADA (OPCIONAL)
-- =====================================================

-- Vista materializada para cachear cálculos de PVP sugerido
-- Útil si hay muchos productos y se consulta frecuentemente

DROP MATERIALIZED VIEW IF EXISTS mv_suggested_pvp_cache;

CREATE MATERIALIZED VIEW mv_suggested_pvp_cache AS
SELECT 
  p.id as product_id,
  p.nombre as product_name,
  p.sku_interno,
  calculate_suggested_pvp(p.id) as suggested_pvp,
  vb2b.precio_b2b,
  pvp.max_pvp as market_max_pvp,
  p.precio_sugerido_venta as admin_suggested_pvp,
  CASE 
    WHEN p.precio_sugerido_venta IS NOT NULL AND p.precio_sugerido_venta > 0 THEN 'admin'
    WHEN pvp.max_pvp IS NOT NULL AND pvp.max_pvp > 0 THEN 'market'
    WHEN vb2b.precio_b2b IS NOT NULL AND vb2b.precio_b2b > 0 THEN 'calculated'
    ELSE 'no_data'
  END as pvp_source,
  NOW() as last_updated
FROM products p
LEFT JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
LEFT JOIN v_product_max_pvp pvp ON pvp.product_id = p.id
WHERE p.is_active = TRUE;

-- Crear índice en la vista materializada
CREATE INDEX idx_mv_suggested_pvp_product_id 
ON mv_suggested_pvp_cache(product_id);

CREATE INDEX idx_mv_suggested_pvp_sku 
ON mv_suggested_pvp_cache(sku_interno);

COMMENT ON MATERIALIZED VIEW mv_suggested_pvp_cache IS 
  'Cache de PVPs sugeridos para todos los productos activos. Refrescar periódicamente con REFRESH MATERIALIZED VIEW';

-- =====================================================
-- 6. FUNCIÓN PARA REFRESCAR CACHE
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_suggested_pvp_cache()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_suggested_pvp_cache;
  RAISE NOTICE 'Cache de PVP sugerido refrescado exitosamente';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_suggested_pvp_cache IS 
  'Refresca el cache de PVPs sugeridos. Ejecutar periódicamente (ej: cada hora o cuando cambien precios)';

-- =====================================================
-- 7. TRIGGER PARA AUTO-REFRESH (OPCIONAL)
-- =====================================================

-- Si quieres auto-refresh cuando cambie seller_catalog o products:

-- CREATE OR REPLACE FUNCTION trigger_refresh_pvp_cache()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   PERFORM refresh_suggested_pvp_cache();
--   RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER after_seller_catalog_change
-- AFTER INSERT OR UPDATE OR DELETE ON seller_catalog
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_pvp_cache();

-- CREATE TRIGGER after_products_price_change
-- AFTER UPDATE OF precio_sugerido_venta ON products
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_pvp_cache();

-- =====================================================
-- 8. QUERIES DE TESTING
-- =====================================================

-- Test 1: Probar función básica
-- SELECT 
--   id,
--   nombre,
--   calculate_suggested_pvp(id) as pvp_sugerido
-- FROM products
-- LIMIT 10;

-- Test 2: Probar función con detalles
-- SELECT * 
-- FROM calculate_suggested_pvp_with_details('PRODUCTO_ID_AQUI');

-- Test 3: Ver productos con diferentes fuentes de PVP
-- SELECT 
--   pvp_source,
--   COUNT(*) as count,
--   AVG(suggested_pvp) as avg_pvp,
--   MIN(suggested_pvp) as min_pvp,
--   MAX(suggested_pvp) as max_pvp
-- FROM mv_suggested_pvp_cache
-- GROUP BY pvp_source
-- ORDER BY count DESC;

-- Test 4: Comparar PVP sugerido vs precio_b2b (margen)
-- SELECT 
--   product_name,
--   precio_b2b,
--   suggested_pvp,
--   pvp_source,
--   ROUND(((suggested_pvp - precio_b2b) / precio_b2b * 100)::numeric, 2) as margen_porcentaje
-- FROM mv_suggested_pvp_cache
-- WHERE precio_b2b > 0 AND suggested_pvp > 0
-- ORDER BY margen_porcentaje DESC
-- LIMIT 20;

-- =====================================================
-- ROLLBACK (si es necesario)
-- =====================================================

-- Para revertir esta migración, ejecutar:
-- DROP FUNCTION IF EXISTS calculate_suggested_pvp;
-- DROP FUNCTION IF EXISTS calculate_suggested_pvp_with_details;
-- DROP FUNCTION IF EXISTS refresh_suggested_pvp_cache;
-- DROP MATERIALIZED VIEW IF EXISTS mv_suggested_pvp_cache;
