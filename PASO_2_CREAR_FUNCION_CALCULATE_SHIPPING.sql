-- =============================================================================
-- PASO 2: CREAR FUNCIÓN calculate_shipping_cost_cart()
-- =============================================================================
-- Ejecuta este script en el SQL Editor de Supabase Dashboard
-- =============================================================================

-- Eliminar versiones antiguas si existen
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric, varchar) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(uuid, numeric, varchar, boolean, numeric, numeric, numeric) CASCADE;

-- Crear la función principal
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type VARCHAR DEFAULT NULL,
  p_is_overweight BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  calculation_breakdown JSONB
) AS $$
DECLARE
  v_tramo_a_cost_per_kg NUMERIC;
  v_tramo_b_cost_per_lb NUMERIC;
  v_base_cost NUMERIC;
  v_extra_cost NUMERIC := 0;
  v_tier_name VARCHAR := 'UNKNOWN';
  v_tier_display VARCHAR := 'Standard';
  v_weight_rounded NUMERIC;
  v_weight_lb NUMERIC;
  v_breakdown JSONB;
BEGIN
  -- Validar peso
  IF p_total_weight_kg <= 0 THEN
    RETURN QUERY SELECT 
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      'INVALID'::VARCHAR,
      'Invalid Weight'::VARCHAR,
      '{"error": "peso debe ser mayor a 0"}'::JSONB;
    RETURN;
  END IF;

  -- Redondear peso hacia arriba
  v_weight_rounded := CEIL(p_total_weight_kg);
  v_weight_lb := v_weight_rounded * 2.20462;

  -- Obtener tarifas de shipping_tiers según el tipo solicitado
  -- Si no se especifica tipo, usar STANDARD por defecto
  SELECT 
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb,
    st.name,
    st.display_name
  INTO 
    v_tramo_a_cost_per_kg,
    v_tramo_b_cost_per_lb,
    v_tier_name,
    v_tier_display
  FROM shipping_tiers st
  JOIN shipping_types sty ON sty.tier_id = st.id
  JOIN shipping_routes sr ON sty.route_id = sr.id
  WHERE sr.id = p_route_id
    AND st.is_active = TRUE
    AND (p_shipping_type IS NULL OR LOWER(st.name) = LOWER(p_shipping_type))
  ORDER BY 
    CASE WHEN p_shipping_type IS NULL THEN 0 ELSE 1 END,
    st.name
  LIMIT 1;

  -- Si no se encontró configuración específica, usar valores por defecto
  IF v_tramo_a_cost_per_kg IS NULL THEN
    v_tramo_a_cost_per_kg := 3.50;  -- China → USA
    v_tramo_b_cost_per_lb := 5.00;  -- USA → Destino final
    v_tier_name := 'STANDARD';
    v_tier_display := 'Standard Shipping';
  END IF;

  -- Calcular costo base
  -- Tramo A: China → USA (por kg)
  -- Tramo B: USA → Destino (por lb)
  v_base_cost := (v_weight_rounded * v_tramo_a_cost_per_kg) + 
                 (v_weight_lb * v_tramo_b_cost_per_lb);

  -- Aplicar cargo adicional por sobrepeso si aplica
  IF p_is_overweight THEN
    v_extra_cost := v_base_cost * 0.15;  -- 15% adicional por sobrepeso
  END IF;

  -- Crear breakdown para transparencia
  v_breakdown := jsonb_build_object(
    'peso_original_kg', p_total_weight_kg,
    'peso_redondeado_kg', v_weight_rounded,
    'peso_lb', ROUND(v_weight_lb, 2),
    'tramo_a_rate', v_tramo_a_cost_per_kg,
    'tramo_a_cost', ROUND(v_weight_rounded * v_tramo_a_cost_per_kg, 2),
    'tramo_b_rate', v_tramo_b_cost_per_lb,
    'tramo_b_cost', ROUND(v_weight_lb * v_tramo_b_cost_per_lb, 2),
    'base_cost', ROUND(v_base_cost, 2),
    'overweight_surcharge', CASE WHEN p_is_overweight THEN ROUND(v_extra_cost, 2) ELSE 0 END,
    'total', ROUND(v_base_cost + v_extra_cost, 2),
    'tier', v_tier_name
  );

  -- Retornar resultado
  RETURN QUERY SELECT 
    v_weight_rounded,
    ROUND(v_base_cost::NUMERIC, 2),
    ROUND(v_extra_cost::NUMERIC, 2),
    ROUND((v_base_cost + v_extra_cost)::NUMERIC, 2),
    v_tier_name,
    v_tier_display,
    v_breakdown;

END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario descriptivo
COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  'Calcula costo de envío para carrito usando tarifas configurables.
   Parámetros:
   - p_route_id: ID de la ruta de envío
   - p_total_weight_kg: Peso total en kilogramos
   - p_shipping_type: Tipo de envío (STANDARD, EXPRESS, ECONOMY) - opcional
   - p_is_overweight: Si tiene sobrepeso (aplica cargo adicional)
   - p_length/width/height_cm: Dimensiones para futuros cálculos volumétricos
   
   Retorna: Peso redondeado, costo base, cargo extra, total, tipo y breakdown detallado';

-- =============================================================================
-- TEST: Verificar que la función se creó correctamente
-- =============================================================================

SELECT 
  '✅ Función calculate_shipping_cost_cart() creada exitosamente' as resultado,
  routine_schema as schema,
  routine_type as tipo
FROM information_schema.routines 
WHERE routine_name = 'calculate_shipping_cost_cart';

-- =============================================================================
-- PRÓXIMO PASO:
-- =============================================================================
-- Una vez veas el mensaje ✅ arriba, ejecuta:
--   PASO_3_CONFIGURAR_TARIFAS_REALES.sql
-- =============================================================================
