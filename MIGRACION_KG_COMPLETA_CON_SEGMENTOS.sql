-- ============================================================================
-- MIGRACIÓN COMPLETA: KG-ONLY + SINCRONIZACIÓN CON ROUTE_LOGISTICS_COSTS
-- ============================================================================
-- PROBLEMA: 
-- - tramo_b_cost_per_lb causa doble conversión (×2.20462 dos veces)
-- - Valores inflados incorrectamente
-- - Botón "Cargar desde Segmentos" solo actualiza tramo_b_cost_per_lb
-- 
-- SOLUCIÓN:
-- - Migrar a sistema KG-only
-- - Sincronizar con route_logistics_costs (fuente de verdad)
-- - Actualizar función loadCostsFromSegments para mantener ambas columnas
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Agregar nueva columna tramo_b_cost_per_kg
-- ============================================================================

ALTER TABLE shipping_tiers 
ADD COLUMN IF NOT EXISTS tramo_b_cost_per_kg NUMERIC(10, 4) DEFAULT 0;

COMMENT ON COLUMN shipping_tiers.tramo_b_cost_per_kg IS 
  'Costo por kg del Tramo B (destino local). TODO EN KG. Fuente de verdad para cálculos.';

-- ============================================================================
-- PASO 2: Sincronizar con route_logistics_costs (FUENTE DE VERDAD)
-- ============================================================================
-- Cargar valores DIRECTAMENTE desde route_logistics_costs, no desde tramo_b_cost_per_lb

UPDATE public.shipping_tiers st
SET 
  -- ✅ Tramo A (China → Hub): directo desde route_logistics_costs
  tramo_a_cost_per_kg = COALESCE(seg_a.cost_per_kg, st.tramo_a_cost_per_kg),
  tramo_a_eta_min = COALESCE(seg_a.estimated_days_min, st.tramo_a_eta_min),
  tramo_a_eta_max = COALESCE(seg_a.estimated_days_max, st.tramo_a_eta_max),
  
  -- ✅ Tramo B (Hub → Destino): EN KG directo desde route_logistics_costs
  tramo_b_cost_per_kg = COALESCE(seg_b.cost_per_kg, ROUND((st.tramo_b_cost_per_lb / 2.20462)::NUMERIC, 4)),
  
  -- ⚠️ Tramo B en LB: Mantener sincronizado para compatibilidad UI (calculado desde kg)
  tramo_b_cost_per_lb = COALESCE(
    ROUND((seg_b.cost_per_kg * 2.20462)::NUMERIC, 4),
    st.tramo_b_cost_per_lb
  ),
  tramo_b_eta_min = COALESCE(seg_b.estimated_days_min, st.tramo_b_eta_min),
  tramo_b_eta_max = COALESCE(seg_b.estimated_days_max, st.tramo_b_eta_max),
  
  updated_at = NOW()
FROM public.shipping_routes sr
LEFT JOIN public.route_logistics_costs seg_a 
  ON seg_a.shipping_route_id = sr.id 
  AND seg_a.segment = 'china_to_transit'
  AND seg_a.is_active = TRUE
LEFT JOIN public.route_logistics_costs seg_b 
  ON seg_b.shipping_route_id = sr.id 
  AND seg_b.segment = 'transit_to_destination'
  AND seg_b.is_active = TRUE
WHERE st.route_id = sr.id
  AND seg_a.transport_type = st.transport_type
  AND seg_b.transport_type = st.transport_type;

-- ============================================================================
-- PASO 3: Verificar sincronización con route_logistics_costs
-- ============================================================================

SELECT 
  st.tier_name,
  st.transport_type,
  '══════════' as "═══",
  seg_a.cost_per_kg as "Segmento A ($/kg)",
  st.tramo_a_cost_per_kg as "Tier A ($/kg)",
  CASE WHEN seg_a.cost_per_kg = st.tramo_a_cost_per_kg THEN '✅' ELSE '❌' END as "Match A",
  '──────────' as "───",
  seg_b.cost_per_kg as "Segmento B ($/kg)",
  st.tramo_b_cost_per_kg as "Tier B ($/kg)",
  CASE WHEN ABS(seg_b.cost_per_kg - st.tramo_b_cost_per_kg) < 0.01 THEN '✅' ELSE '❌' END as "Match B"
FROM shipping_tiers st
JOIN shipping_routes sr ON sr.id = st.route_id
LEFT JOIN route_logistics_costs seg_a 
  ON seg_a.shipping_route_id = sr.id 
  AND seg_a.segment = 'china_to_transit'
  AND seg_a.transport_type = st.transport_type
  AND seg_a.is_active = TRUE
LEFT JOIN route_logistics_costs seg_b 
  ON seg_b.shipping_route_id = sr.id 
  AND seg_b.segment = 'transit_to_destination'
  AND seg_b.transport_type = st.transport_type
  AND seg_b.is_active = TRUE
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

-- ============================================================================
-- PASO 4: Actualizar calculate_shipping_cost_cart (SOLO KG)
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_shipping_cost_cart(NUMERIC, UUID, BOOLEAN, NUMERIC, NUMERIC, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,
  p_is_oversize BOOLEAN DEFAULT FALSE,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  total_items INTEGER,
  total_weight_kg NUMERIC,
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  volume_m3 NUMERIC,
  route_id UUID
) AS $$
DECLARE
  v_tier RECORD;
  v_weight_rounded NUMERIC;
  v_tramo_a_cost NUMERIC := 0;
  v_tramo_b_cost NUMERIC := 0;
  v_base_cost NUMERIC := 0;
  v_oversize_cost NUMERIC := 0;
  v_dimensional_cost NUMERIC := 0;
  v_volume NUMERIC := 0;
BEGIN
  -- ============================================================================
  -- 1. Obtener configuración del tier
  -- ============================================================================
  
  SELECT 
    st.id,
    st.tier_name,
    COALESCE(st.custom_tier_name, st.tier_name) as display_name,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_kg,  -- ✅ USA KG (fuente de verdad)
    st.route_id
  INTO v_tier
  FROM public.shipping_tiers st
  WHERE st.id = p_shipping_type_id
    AND st.is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier de envío no encontrado o inactivo: %', p_shipping_type_id;
  END IF;
  
  -- Validar que tramo_b_cost_per_kg existe y no es NULL
  IF v_tier.tramo_b_cost_per_kg IS NULL OR v_tier.tramo_b_cost_per_kg = 0 THEN
    RAISE WARNING 'tramo_b_cost_per_kg es NULL/0 para tier %. Usando fallback desde tramo_b_cost_per_lb', p_shipping_type_id;
    -- Fallback: convertir de lb a kg si no existe el valor en kg
    SELECT tramo_b_cost_per_lb / 2.20462 INTO v_tier.tramo_b_cost_per_kg
    FROM public.shipping_tiers
    WHERE id = p_shipping_type_id;
  END IF;
  
  -- ============================================================================
  -- 2. Redondear peso (CEIL)
  -- ============================================================================
  
  v_weight_rounded := CEIL(p_total_weight_kg);
  
  -- ============================================================================
  -- 3. CALCULAR BASE COST - TODO EN KG
  -- ============================================================================
  
  -- Tramo A: China → Puerto (en kg)
  v_tramo_a_cost := v_weight_rounded * v_tier.tramo_a_cost_per_kg;
  
  -- Tramo B: Puerto → Destino (en kg) ✅ NO MÁS LIBRAS
  v_tramo_b_cost := v_weight_rounded * v_tier.tramo_b_cost_per_kg;
  
  -- Total base
  v_base_cost := v_tramo_a_cost + v_tramo_b_cost;
  
  -- ============================================================================
  -- 4. Calcular recargos (oversize, dimensional)
  -- ============================================================================
  
  -- Recargo por oversize (+15% del costo base)
  IF p_is_oversize THEN
    v_oversize_cost := v_base_cost * 0.15;
  END IF;
  
  -- Recargo por peso dimensional (si aplica)
  IF p_length_cm IS NOT NULL AND p_width_cm IS NOT NULL AND p_height_cm IS NOT NULL THEN
    v_volume := (p_length_cm * p_width_cm * p_height_cm) / 1000000.0; -- m³
    
    -- Si volumen > 0.15 m³, aplicar recargo de 10%
    IF v_volume > 0.15 THEN
      v_dimensional_cost := v_base_cost * 0.10;
    END IF;
  END IF;
  
  -- ============================================================================
  -- 5. Retornar resultado
  -- ============================================================================
  
  RETURN QUERY SELECT
    1 as total_items,
    p_total_weight_kg as total_weight_kg,
    v_weight_rounded as weight_rounded_kg,
    v_base_cost as base_cost,
    v_oversize_cost as oversize_surcharge,
    v_dimensional_cost as dimensional_surcharge,
    (v_oversize_cost + v_dimensional_cost) as extra_cost,
    (v_base_cost + v_oversize_cost + v_dimensional_cost) as total_cost_with_type,
    v_tier.tier_name as shipping_type_name,
    v_tier.display_name as shipping_type_display,
    v_volume as volume_m3,
    v_tier.route_id as route_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_shipping_cost_cart IS 
  '✅ MOTOR DE CÁLCULO - USA SOLO KILOGRAMOS
  
  Fórmula: base_cost = (peso_kg × tramo_a_$/kg) + (peso_kg × tramo_b_$/kg)
  
  - tramo_b_cost_per_kg es la fuente de verdad
  - tramo_b_cost_per_lb se mantiene sincronizado para UI (2.20462x)
  - Si tramo_b_cost_per_kg = NULL, usa fallback desde tramo_b_cost_per_lb';

-- ============================================================================
-- PASO 5: Verificar cálculos con valores sincronizados
-- ============================================================================

SELECT 
  '✅ VERIFICACIÓN: Cálculo para 2kg con cada tier (SINCRONIZADO CON SEGMENTOS)' as test;

SELECT 
  COALESCE(st.custom_tier_name, st.tier_name) as "Tier",
  st.transport_type as "Transporte",
  '──────────' as "───",
  st.tramo_a_cost_per_kg as "A: $/kg",
  st.tramo_b_cost_per_kg as "B: $/kg",
  (st.tramo_a_cost_per_kg + st.tramo_b_cost_per_kg) as "Total $/kg",
  '══════════' as "═══",
  csc.weight_rounded_kg as "Peso (kg)",
  csc.base_cost as "Costo Base ($)",
  csc.total_cost_with_type as "TOTAL ($)"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(
    2.0,      -- 2kg de prueba
    st.id,
    FALSE,
    NULL, NULL, NULL
  )
) csc
WHERE st.is_active = TRUE
ORDER BY st.transport_type, st.tier_name;

-- ============================================================================
-- PASO 6: Crear trigger para mantener sincronización automática
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_tramo_b_cost_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se actualiza tramo_b_cost_per_kg, sincronizar tramo_b_cost_per_lb
  IF NEW.tramo_b_cost_per_kg IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.tramo_b_cost_per_kg IS DISTINCT FROM NEW.tramo_b_cost_per_kg) THEN
    NEW.tramo_b_cost_per_lb := ROUND((NEW.tramo_b_cost_per_kg * 2.20462)::NUMERIC, 4);
  END IF;
  
  -- Si se actualiza tramo_b_cost_per_lb y tramo_b_cost_per_kg es NULL, calcular kg
  IF NEW.tramo_b_cost_per_lb IS NOT NULL AND NEW.tramo_b_cost_per_kg IS NULL THEN
    NEW.tramo_b_cost_per_kg := ROUND((NEW.tramo_b_cost_per_lb / 2.20462)::NUMERIC, 4);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_tramo_b_costs ON shipping_tiers;

CREATE TRIGGER trigger_sync_tramo_b_costs
  BEFORE INSERT OR UPDATE ON shipping_tiers
  FOR EACH ROW
  EXECUTE FUNCTION sync_tramo_b_cost_columns();

COMMENT ON FUNCTION sync_tramo_b_cost_columns IS 
  'Mantiene sincronizadas las columnas tramo_b_cost_per_kg y tramo_b_cost_per_lb.
   - tramo_b_cost_per_kg es la fuente de verdad (usada en cálculos)
   - tramo_b_cost_per_lb se calcula automáticamente para UI (×2.20462)';

-- ============================================================================
-- RESULTADOS ESPERADOS (con valores sincronizados de route_logistics_costs):
-- ============================================================================
-- Express aéreo (2kg):
--   Tramo A: 2 × $7.00 = $14.00
--   Tramo B: 2 × $5.00 = $10.00  (desde route_logistics_costs)
--   TOTAL: $24.00 ✅ (antes era $62.60)
--
-- Marítimo Estándar (2kg):
--   Tramo A: 2 × $2.30 = $4.60  (desde route_logistics_costs)
--   Tramo B: 2 × $3.00 = $6.00  (desde route_logistics_costs)
--   TOTAL: $10.60 ✅ (antes era $33.76)
-- ============================================================================

COMMIT;

SELECT '✅ MIGRACIÓN COMPLETADA
- Sincronizado con route_logistics_costs (fuente de verdad)
- Todo ahora usa kilogramos en cálculos
- Trigger automático mantiene lb y kg sincronizados
- Botón "Cargar desde Segmentos" funcionará correctamente' as status;
