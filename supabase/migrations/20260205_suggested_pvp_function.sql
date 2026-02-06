-- ============================================
-- FASE 1.3: Función para calcular PVP sugerido
-- Fecha: 2026-02-05
-- Objetivo: Centralizar lógica de cálculo de PVP sugerido
-- ============================================

-- Eliminar función si existe
DROP FUNCTION IF EXISTS public.calculate_suggested_pvp(UUID);

-- Crear función
CREATE OR REPLACE FUNCTION public.calculate_suggested_pvp(
  p_product_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_precio_b2b NUMERIC;
  v_precio_sugerido_admin NUMERIC;
  v_max_pvp_mercado NUMERIC;
  v_markup_categoria NUMERIC;
  v_categoria_id UUID;
  v_resultado NUMERIC;
BEGIN
  -- 1. Obtener precio_b2b del producto
  SELECT precio_b2b, categoria_id 
  INTO v_precio_b2b, v_categoria_id
  FROM public.v_productos_con_precio_b2b
  WHERE id = p_product_id;
  
  -- Si no existe el producto, retornar NULL
  IF v_precio_b2b IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- 2. Verificar si el admin configuró un precio_sugerido_venta
  SELECT precio_sugerido_venta
  INTO v_precio_sugerido_admin
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_precio_sugerido_admin IS NOT NULL AND v_precio_sugerido_admin > 0 THEN
    -- PRIORIDAD 1: Usar precio sugerido por admin
    RETURN ROUND(v_precio_sugerido_admin::numeric, 2);
  END IF;
  
  -- 3. Buscar el PVP máximo de otros sellers en el mercado
  SELECT max_pvp
  INTO v_max_pvp_mercado
  FROM public.v_product_max_pvp
  WHERE product_id = p_product_id;
  
  IF v_max_pvp_mercado IS NOT NULL AND v_max_pvp_mercado > v_precio_b2b THEN
    -- PRIORIDAD 2: Usar PVP máximo del mercado (competitivo)
    RETURN ROUND(v_max_pvp_mercado::numeric, 2);
  END IF;
  
  -- 4. Obtener markup de la categoría
  SELECT default_markup_multiplier
  INTO v_markup_categoria
  FROM public.categories
  WHERE id = v_categoria_id;
  
  IF v_markup_categoria IS NOT NULL AND v_markup_categoria > 0 THEN
    -- PRIORIDAD 3: Calcular usando markup de categoría
    v_resultado := v_precio_b2b * v_markup_categoria;
    RETURN ROUND(v_resultado::numeric, 2);
  END IF;
  
  -- 5. FALLBACK: Usar markup por defecto de 4.0 (300% margen)
  v_resultado := v_precio_b2b * 4.0;
  RETURN ROUND(v_resultado::numeric, 2);
  
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario
COMMENT ON FUNCTION public.calculate_suggested_pvp(UUID) IS 
'Calcula PVP sugerido para un producto siguiendo esta jerarquía:
1. precio_sugerido_venta configurado por admin (si existe)
2. max_pvp de otros sellers en mercado (competitivo)
3. precio_b2b × markup de categoría (si está configurado)
4. precio_b2b × 4.0 (fallback: 300% margen)';

-- ============================================
-- Tests de la función
-- ============================================

-- Test 1: Producto con precio_sugerido_admin configurado
-- Resultado esperado: Debe retornar el precio_sugerido_venta

-- Test 2: Producto sin precio_sugerido pero con otros sellers
-- Resultado esperado: Debe retornar el max_pvp del mercado

-- Test 3: Producto sin precio_sugerido y sin otros sellers
-- Resultado esperado: Debe retornar precio_b2b × markup_categoria

-- Test 4: Producto nuevo (sin categoría markup)
-- Resultado esperado: Debe retornar precio_b2b × 4.0

-- Ejecutar tests (reemplazar UUID con IDs reales):
/*
SELECT 
  p.nombre,
  vp.precio_b2b as "Precio B2B",
  p.precio_sugerido_venta as "Admin Sugiere",
  vm.max_pvp as "Mercado Max",
  c.default_markup_multiplier as "Markup Cat",
  calculate_suggested_pvp(p.id) as "PVP Calculado",
  ROUND(((calculate_suggested_pvp(p.id) - vp.precio_b2b) / vp.precio_b2b * 100)::numeric, 0) as "Margen %"
FROM products p
JOIN v_productos_con_precio_b2b vp ON vp.id = p.id
LEFT JOIN v_product_max_pvp vm ON vm.product_id = p.id
LEFT JOIN categories c ON c.id = p.categoria_id
LIMIT 10;
*/
