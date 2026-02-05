-- ============================================
-- FIX: Motor de Precio B2B Correcto
-- Date: 2026-02-05
-- Issue: precio_b2b mostrando valores incorrectos
-- Root Cause: Margen usando 30% aditivo en vez de 300% multiplicativo
-- ============================================

-- FÓRMULA CORRECTA:
-- precio_b2b = (Costo Base × (1 + Margen%)) + Categoría + Gastos
-- Donde:
--   - Margen% = 300% (significa multiplicar por 4, es decir: costo × (1 + 3.0) = costo × 4)
--   - Categoría = fees de categoría (si aplica)
--   - Gastos = platform fees 12%

-- ============================================
-- 1. CORREGIR FUNCIÓN: calculate_base_price_only
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_base_price_only(
  p_product_id UUID,
  p_margin_percent NUMERIC DEFAULT 300  -- Cambio: 30 → 300
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_base NUMERIC;
  v_categoria_id UUID;
  v_precio_con_margen NUMERIC;
  v_categoria_fee NUMERIC := 0;
  v_platform_fee NUMERIC;
  v_precio_b2b_final NUMERIC;
BEGIN
  -- 1. Obtener costo base y categoría del producto
  SELECT costo_base_excel, categoria_id
  INTO v_costo_base, v_categoria_id
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_base IS NULL OR v_costo_base = 0 THEN
    RETURN 0;
  END IF;
  
  -- 2. Aplicar MARGEN MULTIPLICATIVO
  -- Fórmula: Costo Base × (1 + Margen%)
  -- Ejemplo: $0.88 × (1 + 3.0) = $0.88 × 4.0 = $3.52
  v_precio_con_margen := v_costo_base * (1 + (p_margin_percent / 100.0));
  
  -- 3. Agregar FEES DE CATEGORÍA (si existen)
  -- Aquí se pueden agregar fees específicos por categoría en el futuro
  -- Por ahora: 0
  v_categoria_fee := 0;
  
  -- 4. Calcular PLATFORM FEE (12% sobre precio con margen)
  -- Fórmula: (Precio con margen + categoria_fee) × 12%
  v_platform_fee := (v_precio_con_margen + v_categoria_fee) * 0.12;
  
  -- 5. PRECIO B2B FINAL
  -- Fórmula: Precio con margen + Categoria fee + Platform fee
  v_precio_b2b_final := v_precio_con_margen + v_categoria_fee + v_platform_fee;
  
  RETURN ROUND(v_precio_b2b_final::numeric, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_base_price_only IS 
'Calcula precio B2B usando: (Costo Base × (1 + Margen%)) + Categoría + Gastos (Platform Fee 12%)
Margen por defecto: 300% (multiplicador 4.0)
Ejemplo: $0.88 × 4.0 = $3.52, + 12% = $3.94';

-- ============================================
-- 2. RECREAR VISTA: v_productos_con_precio_b2b
-- ============================================
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  
  -- COSTOS BASE
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,
  
  -- PRECIO B2B CALCULADO CON MOTOR DE PRECIO
  -- Usa la función corregida con margen 300%
  COALESCE(
    public.calculate_base_price_only(p.id, 300),
    0
  ) AS precio_b2b,
  
  -- DESGLOSE DE PRECIO (para referencia)
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) AS precio_con_margen_300,
  ROUND(((p.costo_base_excel * 4.0) * 0.12)::numeric, 2) AS platform_fee,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Categoría
  p.categoria_id,
  c.name AS categoria_nombre,
  
  -- Información de envío (para logística posterior)
  p.weight_kg,
  p.width_cm,
  p.height_cm,
  p.length_cm,
  
  -- Precios sugeridos
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Imágenes
  p.imagen_principal,
  p.galeria_imagenes,
  
  -- Metadata
  p.proveedor_id,
  p.origin_country_id,
  p.currency_code,
  p.url_origen,
  p.peso_kg,
  p.dimensiones_cm,
  p.is_oversize,
  p.shipping_mode,
  p.is_active,
  p.is_parent,
  p.created_at,
  p.updated_at,
  p.last_calculated_at
  
FROM public.products p
LEFT JOIN public.categories c ON p.categoria_id = c.id
WHERE p.is_active = true;

COMMENT ON VIEW public.v_productos_con_precio_b2b IS 
'Vista con precios B2B calculados correctamente usando motor de precio:
(Costo Base × (1 + 300%)) + Categoría + Gastos (12%)
Ejemplo: Producto con costo $0.88 → precio_b2b = $3.94';

-- ============================================
-- 3. PERMISOS
-- ============================================
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;

-- ============================================
-- 4. VERIFICACIÓN
-- ============================================
-- Query de prueba para verificar cálculos
-- SELECT 
--   sku_interno,
--   nombre,
--   costo_base,
--   precio_con_margen_300,
--   platform_fee,
--   precio_b2b,
--   -- Verificación manual
--   ROUND((costo_base * 4.0 * 1.12)::numeric, 2) AS verificacion_manual
-- FROM v_productos_con_precio_b2b
-- WHERE costo_base BETWEEN 0.85 AND 0.91
-- LIMIT 5;
