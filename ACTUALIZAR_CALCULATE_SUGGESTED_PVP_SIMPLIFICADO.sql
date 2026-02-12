-- =============================================================================
-- ACTUALIZACIÓN: Función calculate_suggested_pvp - LÓGICA SIMPLIFICADA
-- Fecha: 2026-02-12
-- Propósito: Simplificar cálculo del PVP sugerido
-- =============================================================================

-- Eliminar función anterior (CASCADE para eliminar dependencias como vistas)
DROP FUNCTION IF EXISTS public.calculate_suggested_pvp(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_suggested_pvp(UUID) CASCADE;

-- =============================================================================
-- CREAR NUEVA FUNCIÓN SIMPLIFICADA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_suggested_pvp(
  p_product_id UUID,
  p_market_id UUID DEFAULT NULL  -- Parámetro reservado para uso futuro
)
RETURNS NUMERIC AS $$
DECLARE
  v_precio_b2c_existente NUMERIC;
  v_precio_b2b NUMERIC;
  v_markup_categoria NUMERIC;
  v_pvp_calculado NUMERIC;
BEGIN
  
  -- =====================================================
  -- PASO 1: Calcular precio usando multiplicador de categoría
  -- =====================================================
  
  -- Obtener precio_b2b y multiplicador de categoría
  SELECT 
    vp.precio_b2b, 
    c.default_markup_multiplier
  INTO 
    v_precio_b2b, 
    v_markup_categoria
  FROM v_productos_con_precio_b2b vp
  JOIN products p ON p.id = vp.id
  LEFT JOIN categories c ON c.id = p.categoria_id
  WHERE vp.id = p_product_id;
  
  -- Si no tenemos precio_b2b, no podemos calcular
  IF v_precio_b2b IS NULL OR v_precio_b2b <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Calcular precio usando multiplicador de categoría o fallback 4x
  IF v_markup_categoria IS NOT NULL AND v_markup_categoria > 0 THEN
    v_pvp_calculado := v_precio_b2b * v_markup_categoria;
  ELSE
    -- Fallback: multiplicar por 4 (300% margen)
    v_pvp_calculado := v_precio_b2b * 4.0;
  END IF;
  
  -- =====================================================
  -- PASO 2: Verificar si existe precio B2C y si es MAYOR
  -- =====================================================
  
  -- Buscar precio B2C existente
  SELECT precio_venta
  INTO v_precio_b2c_existente
  FROM seller_catalog
  WHERE source_product_id = p_product_id
    AND is_active = TRUE
    AND precio_venta > 0
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Si existe precio B2C Y es mayor al calculado, usar el B2C
  IF v_precio_b2c_existente IS NOT NULL 
     AND v_precio_b2c_existente > 0 
     AND v_precio_b2c_existente > v_pvp_calculado THEN
    RETURN ROUND(v_precio_b2c_existente, 2);
  END IF;
  
  -- Caso contrario: usar el precio calculado
  RETURN ROUND(v_pvp_calculado, 2);
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, retornar 0
    RAISE WARNING 'Error calculando PVP sugerido para producto %: %', p_product_id, SQLERRM;
    RETURN 0;
    
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- COMENTARIO
-- =============================================================================

COMMENT ON FUNCTION public.calculate_suggested_pvp IS 
  'Calcula PVP sugerido: 1) precio_b2b × markup_categoria (o 4x fallback), 2) Si existe precio B2C Y es mayor → usar B2C, sino usar el calculado';

-- =============================================================================
-- VERIFICAR QUE categories.default_markup_multiplier EXISTE
-- =============================================================================

-- Si la columna no existe, crearla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'categories' 
      AND column_name = 'default_markup_multiplier'
  ) THEN
    ALTER TABLE public.categories 
    ADD COLUMN default_markup_multiplier NUMERIC DEFAULT 4.0;
    
    COMMENT ON COLUMN public.categories.default_markup_multiplier IS 
      'Multiplicador por defecto para calcular PVP sugerido. Ejemplo: 4.0 = precio_b2b × 4';
  END IF;
END $$;

-- =============================================================================
-- VERIFICACIÓN: Probar la función
-- =============================================================================

-- Test 1: Producto sin precio B2C, con markup de categoría
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  c.default_markup_multiplier as markup_cat,
  ROUND(public.calculate_suggested_pvp(p.id, NULL), 2) as pvp_sugerido,
  ROUND(vb2b.precio_b2b * COALESCE(c.default_markup_multiplier, 4.0), 2) as esperado,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM seller_catalog sc 
      WHERE sc.source_product_id = p.id 
        AND sc.is_active = TRUE 
        AND sc.precio_venta > 0
    ) THEN 'Tiene precio B2C'
    WHEN c.default_markup_multiplier IS NOT NULL THEN 'Usa markup categoría'
    ELSE 'Usa fallback (4x)'
  END as origen
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
LEFT JOIN categories c ON c.id = p.categoria_id
WHERE p.is_active = TRUE
  AND vb2b.precio_b2b > 0
ORDER BY p.updated_at DESC
LIMIT 10;

-- Test 2: Ver categorías con sus multiplicadores
SELECT 
  c.id,
  c.name as categoria,
  c.default_markup_multiplier as multiplicador,
  CASE 
    WHEN c.default_markup_multiplier IS NULL OR c.default_markup_multiplier = 0 
      THEN 'Usará 4.0 (por defecto)'
    ELSE 'Configurado'
  END as estado,
  COUNT(p.id) as total_productos
FROM categories c
LEFT JOIN products p ON p.categoria_id = c.id AND p.is_active = TRUE
GROUP BY c.id, c.name, c.default_markup_multiplier
ORDER BY c.name;

-- Test 3: Comparar antes vs después (si aplicable)
SELECT 
  'ANTES: Usaba precio_sugerido_venta del admin o max_pvp del mercado' as info
UNION ALL
SELECT 
  'AHORA: Calcula precio_b2b × markup, luego usa precio B2C solo si es MAYOR' as info;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Test 1: Debe mostrar pvp_sugerido = precio_b2b × markup
-- Test 2: Debe mostrar todas las categorías con sus multiplicadores
-- Test 3: Información sobre el cambio de lógica
-- =============================================================================

SELECT 'Función actualizada exitosamente. Lógica: calcula precio_b2b × markup, usa B2C solo si es MAYOR' as status;
