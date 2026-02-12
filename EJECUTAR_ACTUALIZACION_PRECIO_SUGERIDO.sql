-- =============================================================================
-- EJECUTAR EN ORDEN: Actualizar Sistema de Precio Sugerido
-- Fecha: 2026-02-12
-- =============================================================================

-- PASO 1: Actualizar función (esto eliminará la vista con CASCADE)
\i ACTUALIZAR_CALCULATE_SUGGESTED_PVP_SIMPLIFICADO.sql

-- PASO 2: Recrear vista actualizada
\i CREAR_VISTA_PRECIO_SUGERIDO_CON_LOGISTICA.sql

-- PASO 3: Actualizar panel de negocio para usar nueva lógica
\i ACTUALIZAR_BUSINESS_PANEL_CON_PRECIO_INTELIGENTE.sql

-- PASO 4: Verificar resultados
SELECT 
  sku,
  item_type,
  cost_per_unit as precio_b2b,
  shipping_cost_per_unit as logistica,
  suggested_pvp_per_unit as pvp_sugerido,
  profit_1unit as ganancia,
  margin_percentage || '%' as margen
FROM v_business_panel_with_shipping_functions
ORDER BY sku
LIMIT 10;

-- PASO 5: Ver diferencia entre productos (lógica inteligente) vs variantes (fallback)
SELECT 
  item_type,
  COUNT(*) as total,
  ROUND(AVG(margin_percentage), 1) || '%' as margen_promedio,
  'Productos usan markup categoría - Variantes usan 4x' as nota
FROM v_business_panel_with_shipping_functions
GROUP BY item_type;
