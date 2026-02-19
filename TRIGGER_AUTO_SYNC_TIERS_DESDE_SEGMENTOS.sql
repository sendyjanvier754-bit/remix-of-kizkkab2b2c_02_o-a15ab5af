-- ============================================================================
-- TRIGGER: AUTO-SINCRONIZACIÓN DE SHIPPING_TIERS DESDE ROUTE_LOGISTICS_COSTS
-- ============================================================================
-- PROPÓSITO:
-- Cuando se actualice un costo en route_logistics_costs (tramos A, B, C, D),
-- AUTOMÁTICAMENTE actualizar los shipping_tiers que usan esa ruta.
--
-- FLUJO:
-- 1. Admin cambia costo en route_logistics_costs
-- 2. Trigger detecta el cambio
-- 3. Actualiza shipping_tiers automáticamente
-- 4. Frontend recibe notificación via Realtime y refresca
-- ============================================================================

-- ============================================================================
-- PASO 1: Función que sincroniza tiers cuando cambian los segmentos
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_shipping_tiers_from_segments()
RETURNS TRIGGER AS $$
DECLARE
  v_route_id UUID;
  v_transport_type VARCHAR;
  v_segment VARCHAR;
BEGIN
  -- Obtener datos del segmento que cambió
  v_route_id := COALESCE(NEW.shipping_route_id, OLD.shipping_route_id);
  v_transport_type := COALESCE(NEW.transport_type, OLD.transport_type);
  v_segment := COALESCE(NEW.segment, OLD.segment);
  
  -- Actualizar todos los tiers que usan esta ruta y tipo de transporte
  UPDATE public.shipping_tiers st
  SET 
    -- Si el segmento es Tramo A (china_to_transit)
    tramo_a_cost_per_kg = CASE 
      WHEN v_segment = 'china_to_transit' AND NEW.segment IS NOT NULL 
      THEN NEW.cost_per_kg 
      ELSE st.tramo_a_cost_per_kg 
    END,
    tramo_a_eta_min = CASE 
      WHEN v_segment = 'china_to_transit' AND NEW.segment IS NOT NULL 
      THEN NEW.estimated_days_min 
      ELSE st.tramo_a_eta_min 
    END,
    tramo_a_eta_max = CASE 
      WHEN v_segment = 'china_to_transit' AND NEW.segment IS NOT NULL 
      THEN NEW.estimated_days_max 
      ELSE st.tramo_a_eta_max 
    END,
    
    -- Si el segmento es Tramo B (transit_to_destination)
    tramo_b_cost_per_kg = CASE 
      WHEN v_segment = 'transit_to_destination' AND NEW.segment IS NOT NULL 
      THEN NEW.cost_per_kg 
      ELSE st.tramo_b_cost_per_kg 
    END,
    tramo_b_cost_per_lb = CASE 
      WHEN v_segment = 'transit_to_destination' AND NEW.segment IS NOT NULL 
      THEN ROUND((NEW.cost_per_kg * 2.20462)::NUMERIC, 4)
      ELSE st.tramo_b_cost_per_lb 
    END,
    tramo_b_eta_min = CASE 
      WHEN v_segment = 'transit_to_destination' AND NEW.segment IS NOT NULL 
      THEN NEW.estimated_days_min 
      ELSE st.tramo_b_eta_min 
    END,
    tramo_b_eta_max = CASE 
      WHEN v_segment = 'transit_to_destination' AND NEW.segment IS NOT NULL 
      THEN NEW.estimated_days_max 
      ELSE st.tramo_b_eta_max 
    END,
    
    updated_at = NOW()
  WHERE st.route_id = v_route_id
    AND st.transport_type = v_transport_type
    AND st.is_active = TRUE;
  
  -- Log para debug (opcional)
  RAISE NOTICE 'Auto-sincronización: % tiers actualizados para ruta % con transporte %', 
    (SELECT COUNT(*) FROM shipping_tiers WHERE route_id = v_route_id AND transport_type = v_transport_type),
    v_route_id,
    v_transport_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_shipping_tiers_from_segments IS 
  'Sincroniza automáticamente shipping_tiers cuando cambian los route_logistics_costs.
   Se ejecuta via trigger después de INSERT/UPDATE en route_logistics_costs.';

-- ============================================================================
-- PASO 2: Crear trigger en route_logistics_costs
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_sync_tiers_from_segments ON route_logistics_costs;

CREATE TRIGGER trigger_auto_sync_tiers_from_segments
  AFTER INSERT OR UPDATE OF cost_per_kg, estimated_days_min, estimated_days_max
  ON public.route_logistics_costs
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE AND NEW.segment IN ('china_to_transit', 'transit_to_destination'))
  EXECUTE FUNCTION sync_shipping_tiers_from_segments();

COMMENT ON TRIGGER trigger_auto_sync_tiers_from_segments ON route_logistics_costs IS
  'Auto-sincroniza shipping_tiers cuando se actualizan costos o ETAs en route_logistics_costs.
   Solo se activa para segmentos de Tramo A (china_to_transit) y Tramo B (transit_to_destination).';

-- ============================================================================
-- PASO 3: Sincronización inicial (cargar valores actuales)
-- ============================================================================

-- Actualizar todos los tiers con los valores actuales de route_logistics_costs
UPDATE public.shipping_tiers st
SET 
  -- Tramo A (China → Hub)
  tramo_a_cost_per_kg = COALESCE(seg_a.cost_per_kg, st.tramo_a_cost_per_kg),
  tramo_a_eta_min = COALESCE(seg_a.estimated_days_min, st.tramo_a_eta_min),
  tramo_a_eta_max = COALESCE(seg_a.estimated_days_max, st.tramo_a_eta_max),
  
  -- Tramo B (Hub → Destino) - EN KG
  tramo_b_cost_per_kg = COALESCE(seg_b.cost_per_kg, st.tramo_b_cost_per_kg),
  
  -- Tramo B en LB (sincronizado para UI)
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
  AND st.is_active = TRUE
  AND (seg_a.transport_type = st.transport_type OR seg_a.transport_type IS NULL)
  AND (seg_b.transport_type = st.transport_type OR seg_b.transport_type IS NULL);

-- ============================================================================
-- PASO 4: Verificar sincronización
-- ============================================================================

SELECT 
  '✅ Verificación: Tiers sincronizados con route_logistics_costs' as status;

SELECT 
  st.tier_name,
  st.transport_type,
  '──────────' as "───",
  seg_a.cost_per_kg as "Segmento A ($/kg)",
  st.tramo_a_cost_per_kg as "Tier A ($/kg)",
  CASE 
    WHEN ABS(COALESCE(seg_a.cost_per_kg, 0) - st.tramo_a_cost_per_kg) < 0.01 
    THEN '✅' ELSE '❌' 
  END as "Sync A",
  '──────────' as " ───",
  seg_b.cost_per_kg as "Segmento B ($/kg)",
  st.tramo_b_cost_per_kg as "Tier B ($/kg)",
  CASE 
    WHEN ABS(COALESCE(seg_b.cost_per_kg, 0) - st.tramo_b_cost_per_kg) < 0.01 
    THEN '✅' ELSE '❌' 
  END as "Sync B"
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
-- PASO 5: Prueba del trigger
-- ============================================================================

SELECT '🧪 Para probar el trigger, ejecuta esto:' as test;

/*
-- Ejemplo: Cambiar costo del Tramo A para ruta con transporte aéreo
UPDATE route_logistics_costs
SET cost_per_kg = 7.50  -- Cambiar de 7.00 a 7.50
WHERE segment = 'china_to_transit'
  AND transport_type = 'aereo'
  AND is_active = TRUE
LIMIT 1;

-- Verificar que shipping_tiers se actualizó automáticamente
SELECT 
  tier_name,
  tramo_a_cost_per_kg as "Nuevo Tramo A (debe ser 7.50)",
  updated_at
FROM shipping_tiers
WHERE transport_type = 'aereo'
  AND is_active = TRUE;
*/

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- ✅ Trigger activo
-- ✅ Cuando actualizas route_logistics_costs → shipping_tiers se actualiza solo
-- ✅ Frontend con Realtime subscription recibirá notificación
-- ✅ Carrito se recalcula automáticamente
-- ============================================================================

SELECT '✅ TRIGGER INSTALADO - Auto-sincronización activa' as status;
SELECT 'Ahora cuando cambies un tramo, los tipos de envío se actualizarán automáticamente' as info;
