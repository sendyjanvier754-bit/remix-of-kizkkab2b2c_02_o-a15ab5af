-- ============================================
-- FIX VARIANT PRICING - Each variant has its OWN base price
-- Fecha: 2026-02-04
-- Problema: Variantes no tienen precios adicionales, tienen su PROPIO precio base
-- Solución: Cada variante debe pasar por el motor de precios con su costo_base propio
-- ============================================

-- Explicación:
-- Antes: precio_b2b_variante = precio_b2b_padre × (1 + price_adjustment%)
-- Ahora: precio_b2b_variante = calculate_base_price_only(variante.cost_price)

DROP VIEW IF EXISTS public.v_variantes_con_precio_b2b CASCADE;

CREATE VIEW public.v_variantes_con_precio_b2b AS
SELECT
  pv.id,
  pv.product_id,
  pv.sku,
  pv.name,
  pv.attribute_combination,
  
  -- Precio base efectivo de la variante (PROPIO, no del padre)
  COALESCE(pv.cost_price, p.costo_base_excel) AS costo_base_variante,
  
  -- Calcular margen aplicable según el costo de la variante
  COALESCE(
    (SELECT margin_percent FROM public.b2b_margin_ranges 
     WHERE is_active = true 
       AND COALESCE(pv.cost_price, p.costo_base_excel) >= min_cost 
       AND (max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < max_cost)
     ORDER BY sort_order ASC
     LIMIT 1),
    30
  ) AS applied_margin_percent,
  
  -- CRÍTICO: Calcular precio_b2b usando EL COSTO DE LA VARIANTE como base
  -- NO usar el precio del producto padre
  -- La función calculate_base_price_only() internamente usa:
  --   costo_base + margen(30%) + fees(12%)
  -- Pero recibe el product_id. Necesitamos pasar el costo de la variante.
  --
  -- Como la función está diseñada para productos y no acepta un costo directo,
  -- tenemos que calcular manualmente aquí:
  ROUND(
    (COALESCE(pv.cost_price, p.costo_base_excel) * 
     (1 + (COALESCE(
       (SELECT margin_percent FROM public.b2b_margin_ranges 
        WHERE is_active = true 
          AND COALESCE(pv.cost_price, p.costo_base_excel) >= min_cost 
          AND (max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < max_cost)
        ORDER BY sort_order ASC
        LIMIT 1),
       30
     ) / 100.0)) * 
     (1 + 0.12))  -- 12% fee fijo
    ::numeric, 2
  ) AS precio_b2b_final,
  
  -- Otros campos
  pv.price,
  pv.price_adjustment,
  pv.stock,
  pv.moq,
  pv.images,
  pv.is_active,
  p.sku_interno AS parent_sku,
  p.nombre AS product_name,
  pv.created_at,
  pv.updated_at
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

COMMENT ON VIEW public.v_variantes_con_precio_b2b IS 
'Vista de variantes con precio B2B calculado. IMPORTANTE: Cada variante tiene su PROPIO precio base (cost_price), NO es un ajuste sobre el producto padre. El precio_b2b_final se calcula aplicando márgenes y fees al costo de la variante.';

-- ============================================
-- Actualizar vista simplificada también
-- ============================================

DROP VIEW IF EXISTS public.v_variantes_precio_simple CASCADE;

CREATE VIEW public.v_variantes_precio_simple AS
SELECT
  pv.id,
  pv.sku,
  pv.product_id,
  pv.attribute_combination,
  COALESCE(pv.cost_price, p.costo_base_excel) AS costo_base_variante,
  ROUND(
    (COALESCE(pv.cost_price, p.costo_base_excel) * 
     (1 + (COALESCE(
       (SELECT margin_percent FROM public.b2b_margin_ranges 
        WHERE is_active = true 
          AND COALESCE(pv.cost_price, p.costo_base_excel) >= min_cost 
          AND (max_cost IS NULL OR COALESCE(pv.cost_price, p.costo_base_excel) < max_cost)
        ORDER BY sort_order ASC
        LIMIT 1),
       30
     ) / 100.0)) * 
     (1 + 0.12))
    ::numeric, 2
  ) AS precio_b2b_final
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true;

-- ============================================
-- Verificación de datos
-- ============================================

-- Para verificar que los precios se calculan correctamente:
-- SELECT 
--   pv.sku,
--   pv.name,
--   vv.costo_base_variante AS "Costo Base",
--   vv.applied_margin_percent AS "Margen %",
--   vv.precio_b2b_final AS "Precio B2B"
-- FROM product_variants pv
-- JOIN v_variantes_con_precio_b2b vv ON vv.id = pv.id
-- WHERE pv.product_id = '<UUID_PRODUCTO_EJEMPLO>'
-- ORDER BY pv.sku;

-- Ejemplo esperado:
-- Camiseta Rosa (cost_price = $5.00)
--   → margen 30% → $6.50
--   → fee 12% → $7.28 (precio_b2b_final)
--
-- Camiseta Negra (cost_price = $8.00)
--   → margen 30% → $10.40
--   → fee 12% → $11.65 (precio_b2b_final)
