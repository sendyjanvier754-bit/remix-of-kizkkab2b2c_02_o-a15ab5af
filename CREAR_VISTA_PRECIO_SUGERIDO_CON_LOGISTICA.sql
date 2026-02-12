-- =============================================================================
-- VISTA: v_precio_sugerido_con_logistica
-- Fecha: 2026-02-12
-- Propósito: Calcular precio sugerido de venta incluyendo costo de logística
-- =============================================================================

CREATE OR REPLACE VIEW v_precio_sugerido_con_logistica AS
SELECT 
  p.id as product_id,
  p.sku_interno as sku,
  p.nombre as product_name,
  p.categoria_id,
  c.name as categoria_nombre,
  
  -- ========================================================================
  -- COSTOS BASE
  -- ========================================================================
  
  -- Precio B2B (sin logística)
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  
  -- Costo de logística ACTUAL desde la vista
  ROUND(COALESCE(vpsc.total_cost, 0), 2) as costo_logistica_actual,
  
  -- Peso usado en el cálculo
  vpsc.weight_kg as peso_kg,
  
  -- ========================================================================
  -- COSTO TOTAL (B2B + LOGÍSTICA)
  -- ========================================================================
  
  ROUND((vb2b.precio_b2b + COALESCE(vpsc.total_cost, 0)), 2) as costo_total_con_logistica,
  
  -- ========================================================================
  -- PRECIO SUGERIDO DE VENTA
  -- ========================================================================
  
  -- PVP sugerido usando la función existente
  ROUND(public.calculate_suggested_pvp(p.id, NULL), 2) as pvp_sugerido,
  
  -- ========================================================================
  -- MARKUP Y MÁRGENES
  -- ========================================================================
  
  -- Markup sobre precio B2B (sin logística)
  CASE 
    WHEN vb2b.precio_b2b > 0 THEN
      ROUND(((public.calculate_suggested_pvp(p.id, NULL) - vb2b.precio_b2b) / vb2b.precio_b2b * 100)::numeric, 1)
    ELSE 0
  END as markup_sobre_b2b_percent,
  
  -- Markup sobre costo total (B2B + logística)
  CASE 
    WHEN (vb2b.precio_b2b + COALESCE(vpsc.total_cost, 0)) > 0 THEN
      ROUND(((public.calculate_suggested_pvp(p.id, NULL) - (vb2b.precio_b2b + COALESCE(vpsc.total_cost, 0))) / 
             (vb2b.precio_b2b + COALESCE(vpsc.total_cost, 0)) * 100)::numeric, 1)
    ELSE 0
  END as markup_sobre_costo_total_percent,
  
  -- Ganancia por unidad (PVP - Costo Total)
  ROUND((public.calculate_suggested_pvp(p.id, NULL) - (vb2b.precio_b2b + COALESCE(vpsc.total_cost, 0))), 2) 
    as ganancia_por_unidad,
  
  -- ========================================================================
  -- DESGLOSE DEL CÁLCULO
  -- ========================================================================
  
  -- Desglose del costo de logística
  ROUND(COALESCE(vpsc.base_cost, 0), 2) as logistica_base,
  ROUND(COALESCE(vpsc.oversize_surcharge, 0), 2) as logistica_oversize,
  ROUND(COALESCE(vpsc.dimensional_surcharge, 0), 2) as logistica_dimensional,
  
  -- Porcentaje del costo de logística sobre el precio B2B
  CASE 
    WHEN vb2b.precio_b2b > 0 THEN
      ROUND((COALESCE(vpsc.total_cost, 0) / vb2b.precio_b2b * 100)::numeric, 1)
    ELSE 0
  END as logistica_percent_de_b2b,
  
  -- ========================================================================
  -- ORIGEN DEL PRECIO SUGERIDO (NUEVA LÓGICA: B2C solo si es MAYOR)
  -- ========================================================================
  
  CASE 
    -- Verificar si precio B2C existe Y es mayor al calculado
    WHEN EXISTS (
      SELECT 1 FROM seller_catalog sc
      WHERE sc.source_product_id = p.id
        AND sc.is_active = TRUE
        AND sc.precio_venta > 0
        AND sc.precio_venta > (vb2b.precio_b2b * COALESCE(c.default_markup_multiplier, 4.0))
    ) THEN '1. B2C (más alto que calculado)'
    WHEN c.default_markup_multiplier IS NOT NULL AND c.default_markup_multiplier > 0 
      THEN '2. Markup categoría (' || c.default_markup_multiplier || 'x)'
    ELSE '3. Fallback (4.0x)'
  END as origen_pvp,
  
  -- Precio en catálogo B2C (si existe)
  (SELECT precio_venta FROM seller_catalog sc
   WHERE sc.source_product_id = p.id
     AND sc.is_active = TRUE
     AND sc.precio_venta > 0
   ORDER BY sc.updated_at DESC
   LIMIT 1) as precio_b2c_existente,
  
  -- Markup de categoría
  c.default_markup_multiplier as categoria_markup,
  
  -- ========================================================================
  -- METADATA
  -- ========================================================================
  
  p.is_active,
  p.is_oversize,
  vpsc.volume_m3,
  p.updated_at as last_updated

FROM products p

-- Join con precio B2B
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id

-- Join con costos de logística
LEFT JOIN v_product_shipping_costs vpsc ON vpsc.product_id = p.id

-- Join con categoría
LEFT JOIN categories c ON c.id = p.categoria_id

-- NO necesitamos más v_product_max_pvp con la nueva lógica

WHERE p.is_active = TRUE
  AND vb2b.precio_b2b > 0;

-- =============================================================================
-- COMENTARIO DE LA VISTA
-- =============================================================================

COMMENT ON VIEW v_precio_sugerido_con_logistica IS 
  'Vista que combina precio B2B + costo de logística actual + PVP sugerido. 
  Nueva lógica: 1) Calcula precio_b2b × markup_categoria (o 4x fallback), 2) Usa precio B2C solo si es MAYOR al calculado.
  Calcula márgenes sobre costo total (incluyendo logística) y muestra origen del precio sugerido.';
-- =============================================================================
-- PERMISOS
-- =============================================================================

GRANT SELECT ON v_precio_sugerido_con_logistica TO anon, authenticated;

-- =============================================================================
-- EJEMPLOS DE USO
-- =============================================================================

-- Ejemplo 1: Ver productos con mejor margen
SELECT 
  sku,
  product_name,
  costo_total_con_logistica,
  pvp_sugerido,
  ganancia_por_unidad,
  markup_sobre_costo_total_percent || '%' as margen
FROM v_precio_sugerido_con_logistica
ORDER BY ganancia_por_unidad DESC
LIMIT 10;

-- Ejemplo 2: Ver productos donde la logística es alta
SELECT 
  sku,
  product_name,
  precio_b2b,
  costo_logistica_actual,
  logistica_percent_de_b2b || '%' as logistica_pct,
  costo_total_con_logistica
FROM v_precio_sugerido_con_logistica
WHERE logistica_percent_de_b2b > 50  -- Logística > 50% del precio B2B
ORDER BY logistica_percent_de_b2b DESC;

-- Ejemplo 3: Comparar PVP sugerido vs costo total
SELECT 
  sku,
  product_name,
  precio_b2b,
  costo_logistica_actual,
  costo_total_con_logistica,
  pvp_sugerido,
  ganancia_por_unidad,
  origen_pvp
FROM v_precio_sugerido_con_logistica
ORDER BY product_name
LIMIT 20;

-- Ejemplo 4: Estadísticas generales
SELECT 
  COUNT(*) as total_productos,
  ROUND(AVG(precio_b2b), 2) as avg_precio_b2b,
  ROUND(AVG(costo_logistica_actual), 2) as avg_logistica,
  ROUND(AVG(costo_total_con_logistica), 2) as avg_costo_total,
  ROUND(AVG(pvp_sugerido), 2) as avg_pvp_sugerido,
  ROUND(AVG(ganancia_por_unidad), 2) as avg_ganancia,
  ROUND(AVG(markup_sobre_costo_total_percent), 1) || '%' as avg_margen
FROM v_precio_sugerido_con_logistica;

-- Ejemplo 5: Productos por origen de precio sugerido
SELECT 
  origen_pvp,
  COUNT(*) as cantidad,
  ROUND(AVG(precio_b2b), 2) as avg_b2b,
  ROUND(AVG(pvp_sugerido), 2) as avg_pvp,
  ROUND(AVG(markup_sobre_costo_total_percent), 1) || '%' as avg_margen
FROM v_precio_sugerido_con_logistica
GROUP BY origen_pvp
ORDER BY cantidad DESC;

-- =============================================================================
-- VERIFICACIÓN: Listar primeros registros
-- =============================================================================

SELECT 
  sku,
  product_name,
  precio_b2b || ' + ' || costo_logistica_actual || ' = ' || costo_total_con_logistica as desglose_costo,
  pvp_sugerido,
  ganancia_por_unidad,
  markup_sobre_costo_total_percent || '%' as margen,
  origen_pvp
FROM v_precio_sugerido_con_logistica
ORDER BY sku
LIMIT 10;
