-- ============================================================================
-- VERIFICAR Y CREAR TIER PARA HAITÍ
-- ============================================================================

-- 1. Ver si existe la ruta de Haití
SELECT 
  '🔍 Ruta de Haití' as info,
  id,
  route_name,
  origin_country,
  destination_country,
  destination_country_id,
  is_active
FROM public.shipping_routes
WHERE id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- 2. Ver si hay tiers configurados para esta ruta
SELECT 
  '🔍 Tiers existentes para Haití' as info,
  id,
  route_id,
  tier_type,
  tier_name,
  custom_tier_name,
  transport_type,
  tramo_a_cost_per_kg,
  tramo_a_eta_min,
  tramo_a_eta_max,
  tramo_b_cost_per_lb,
  tramo_b_eta_min,
  tramo_b_eta_max,
  is_active,
  priority_order
FROM public.shipping_tiers
WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- 3. Ver route_logistics_costs relacionados
SELECT 
  '🔍 Route logistics costs para Haití' as info,
  id,
  shipping_route_id,
  segment,
  cost_per_kg,
  cost_per_lb,
  cost_per_cbm,
  min_cost,
  is_active
FROM public.route_logistics_costs
WHERE shipping_route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- ============================================================================
-- CREAR TIER EXPRESS PARA HAITÍ (SI NO EXISTE)
-- ============================================================================

-- Verificar si ya existe
DO $$
DECLARE
  v_existing_tier_count INT;
BEGIN
  SELECT COUNT(*) INTO v_existing_tier_count
  FROM shipping_tiers
  WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';
  
  IF v_existing_tier_count = 0 THEN
    -- Crear tier Express para Haití con valores realistas
    INSERT INTO public.shipping_tiers (
      route_id,
      tier_type,
      tier_name,
      custom_tier_name,
      transport_type,
      tramo_a_cost_per_kg,
      tramo_a_eta_min,
      tramo_a_eta_max,
      tramo_b_cost_per_lb,
      tramo_b_eta_min,
      tramo_b_eta_max,
      is_active,
      priority_order
    ) VALUES (
      '21420dcb-9d8a-4947-8530-aaf3519c9047',
      'express',
      'Express',
      'Express aereo - China → Haiti',
      'aereo',
      4.50, -- $4.50/kg China → USA
      10,   -- ETA min 10 días
      15,   -- ETA max 15 días
      3.00, -- $3.00/lb USA → Haiti
      8,    -- ETA min 8 días
      12,   -- ETA max 12 días
      true,
      1
    );
    
    RAISE NOTICE '✅ Tier Express creado para Haití';
  ELSE
    RAISE NOTICE '⚠️ Ya existen % tiers para Haití', v_existing_tier_count;
  END IF;
END $$;

-- ============================================================================
-- VERIFICAR QUE EL TIER SE CREÓ CORRECTAMENTE
-- ============================================================================

SELECT 
  '✅ Tiers después de creación' as info,
  id,
  tier_type,
  tier_name,
  custom_tier_name,
  transport_type,
  tramo_a_cost_per_kg,
  tramo_a_eta_min || '-' || tramo_a_eta_max as tramo_a_eta,
  tramo_b_cost_per_lb,
  tramo_b_eta_min || '-' || tramo_b_eta_max as tramo_b_eta,
  is_active
FROM public.shipping_tiers
WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047';

-- ============================================================================
-- PROBAR LA FUNCIÓN CON EL NUEVO TIER
-- ============================================================================

DO $$
DECLARE
  v_tier_id UUID;
  v_result RECORD;
BEGIN
  -- Obtener el tier ID
  SELECT id INTO v_tier_id
  FROM shipping_tiers
  WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
  LIMIT 1;
  
  IF v_tier_id IS NOT NULL THEN
    RAISE NOTICE '🧪 Probando función con tier ID: %', v_tier_id;
    
    -- Mostrar resultado del cálculo
    FOR v_result IN 
      SELECT * FROM calculate_shipping_cost_cart(
        '21420dcb-9d8a-4947-8530-aaf3519c9047',
        2.5, -- 2.5 kg → redondea a 3 kg
        v_tier_id,
        FALSE
      )
    LOOP
      RAISE NOTICE '📦 Peso: % kg', v_result.weight_rounded_kg;
      RAISE NOTICE '💰 Costo base: $%', v_result.base_cost;
      RAISE NOTICE '💰 Total: $%', v_result.total_cost_with_type;
      RAISE NOTICE '📛 Tipo: %', v_result.shipping_type_display;
    END LOOP;
  ELSE
    RAISE WARNING '⚠️ No se pudo crear el tier';
  END IF;
END $$;
