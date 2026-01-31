-- ============================================
-- FIX: Apply dynamic margin ranges from b2b_margin_ranges
-- Date: 2026-01-31
-- ============================================
-- This migration updates calculate_base_price_only to use
-- the configured margin ranges instead of a fixed 30%

-- Drop and recreate the function with dynamic margin lookup
CREATE OR REPLACE FUNCTION public.calculate_base_price_only(
  p_product_id UUID,
  p_margin_percent NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_fabrica NUMERIC;
  v_margin_value NUMERIC;
  v_fee_plataforma NUMERIC;
  v_base_price NUMERIC;
  v_margin_percent NUMERIC;
BEGIN
  -- 1. Obtener costo base del producto
  SELECT costo_base_excel
  INTO v_costo_fabrica
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_fabrica IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 2. Determinar el margen a aplicar
  -- Si se pasa un margen explícito, usarlo
  IF p_margin_percent IS NOT NULL THEN
    v_margin_percent := p_margin_percent;
  ELSE
    -- Buscar el margen en rangos configurados según el costo base
    SELECT margin_percent
    INTO v_margin_percent
    FROM public.b2b_margin_ranges
    WHERE is_active = true
      AND v_costo_fabrica >= min_cost
      AND (max_cost IS NULL OR v_costo_fabrica < max_cost)
    ORDER BY sort_order ASC
    LIMIT 1;
    
    -- Si no se encuentra rango, usar 30% por defecto
    IF v_margin_percent IS NULL THEN
      v_margin_percent := 30;
    END IF;
  END IF;
  
  -- 3. Calcular MARGEN (aplicado al costo base)
  -- Protection Rule: el margen se aplica al costo de fábrica
  v_margin_value := v_costo_fabrica * (v_margin_percent / 100.0);
  
  -- 4. Calcular FEE DE PLATAFORMA (12% sobre costo + margen)
  -- Platform fee se aplica después del margen
  v_fee_plataforma := (v_costo_fabrica + v_margin_value) * 0.12;
  
  -- 5. PRECIO BASE FINAL (sin logística)
  v_base_price := v_costo_fabrica + v_margin_value + v_fee_plataforma;
  
  RETURN ROUND(v_base_price::numeric, 2);
END;
$$;

-- Update the v_productos_con_precio_b2b view to use the new function
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.categoria_id,
  p.costo_base_excel,
  p.peso_kg,
  p.imagen_principal,
  -- Calcular precio B2B dinámicamente con margen del rango configurado
  public.calculate_base_price_only(p.id, NULL) AS precio_b2b,
  -- Incluir también el margen que se aplicó para debugging
  COALESCE(
    (SELECT margin_percent FROM public.b2b_margin_ranges 
     WHERE is_active = true 
       AND p.costo_base_excel >= min_cost 
       AND (max_cost IS NULL OR p.costo_base_excel < max_cost)
     ORDER BY sort_order ASC
     LIMIT 1),
    30
  ) AS applied_margin_percent,
  p.is_active,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.is_active = true;

-- Verify the margins were applied correctly
SELECT 
  'Margin ranges configuration check' AS test,
  COUNT(*) AS total_ranges,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS active_ranges
FROM public.b2b_margin_ranges;

-- Sample verification of price calculation
SELECT 
  p.id,
  p.sku_interno,
  p.nombre,
  p.costo_base_excel,
  bmr.margin_percent AS applied_margin,
  public.calculate_base_price_only(p.id, NULL) AS precio_b2b_calculated,
  ROUND((p.costo_base_excel * (bmr.margin_percent / 100.0))::numeric, 2) AS margin_component,
  ROUND(((p.costo_base_excel + (p.costo_base_excel * (bmr.margin_percent / 100.0))) * 0.12)::numeric, 2) AS platform_fee
FROM public.products p
LEFT JOIN public.b2b_margin_ranges bmr ON (
  p.costo_base_excel >= bmr.min_cost 
  AND (bmr.max_cost IS NULL OR p.costo_base_excel < bmr.max_cost)
  AND bmr.is_active = true
)
WHERE p.is_active = true
ORDER BY p.costo_base_excel ASC
LIMIT 10;
