-- ============================================================================
-- REVERTIR: Restaurar función calculate_shipping_cost_cart ORIGINAL
-- ============================================================================
-- Esta función restaura la versión que usa shipping_type_configs

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID DEFAULT NULL,
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  volume_m3 NUMERIC
) AS $$
DECLARE
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_base_cost NUMERIC;
  v_extra_cost_fixed NUMERIC;
  v_extra_cost_percent NUMERIC;
  v_extra_cost NUMERIC := 0;
  v_total_extra NUMERIC := 0;
  v_type_name VARCHAR;
  v_type_display VARCHAR;
  v_weight_rounded NUMERIC;
  v_oversize_surcharge NUMERIC := 0;
  v_dimensional_surcharge NUMERIC := 0;
  v_volume_m3 NUMERIC := 0;
BEGIN
  -- Redondear peso a superior (CEIL)
  v_weight_rounded := CEIL(p_total_weight_kg);

  -- Obtener costos del tramo A
  SELECT cost_per_kg INTO v_tramo_a_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'china_to_transit'
  LIMIT 1;

  -- Obtener costos del tramo B
  SELECT cost_per_kg INTO v_tramo_b_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'transit_to_destination'
  LIMIT 1;

  -- Usar valores por defecto si no existen
  v_tramo_a_cost := COALESCE(v_tramo_a_cost, 3.50);
  v_tramo_b_cost := COALESCE(v_tramo_b_cost, 5.00);

  -- Calcular costo base con peso redondeado
  v_base_cost := (v_weight_rounded * v_tramo_a_cost) + (v_weight_rounded * 2.20462 * v_tramo_b_cost);

  -- ============================================================================
  -- Surcharges por oversize y dimensiones
  -- ============================================================================

  -- 1. Aplicar surcharge si es oversize (+15% del costo base)
  IF p_is_oversize = TRUE THEN
    v_oversize_surcharge := ROUND((v_base_cost * 0.15)::NUMERIC, 2);
  END IF;

  -- 2. Calcular surcharge por volumen si las dimensiones están disponibles
  IF p_length_cm IS NOT NULL 
     AND p_width_cm IS NOT NULL 
     AND p_height_cm IS NOT NULL THEN
    
    -- Calcular volumen en metros cúbicos
    v_volume_m3 := ROUND((p_length_cm * p_width_cm * p_height_cm / 1000000.0)::NUMERIC, 6);
    
    -- Aplicar surcharge si volumen > 0.15 m³ (+10% del costo base)
    IF v_volume_m3 > 0.15 THEN
      v_dimensional_surcharge := ROUND((v_base_cost * 0.10)::NUMERIC, 2);
    END IF;
  END IF;

  -- Si se proporciona tipo de envío, obtener surcharges de shipping_type_configs
  IF p_shipping_type_id IS NOT NULL THEN
    SELECT 
      type,
      display_name,
      extra_cost_fixed,
      extra_cost_percent
    INTO v_type_name, v_type_display, v_extra_cost_fixed, v_extra_cost_percent
    FROM public.shipping_type_configs
    WHERE id = p_shipping_type_id
      AND is_active = TRUE;

    -- Calcular extra cost: cargo fijo + porcentaje del costo base
    v_total_extra := COALESCE(v_extra_cost_fixed, 0) + 
                     (v_base_cost * COALESCE(v_extra_cost_percent, 0) / 100);
    v_extra_cost := v_total_extra;
  END IF;

  RETURN QUERY SELECT 
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    v_oversize_surcharge,
    v_dimensional_surcharge,
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost + v_oversize_surcharge + v_dimensional_surcharge)::NUMERIC, 2),
    v_type_name,
    v_type_display,
    v_volume_m3;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito con peso redondeado, surcharges del tipo de envío (shipping_type_configs), y surcharges por oversize/dimensiones';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT '✅ Función calculate_shipping_cost_cart restaurada a versión ORIGINAL (usa shipping_type_configs)' as resultado;
