-- =============================================================================
-- VERIFICACIÓN: ¿Nuestra función usa el mismo sistema que Logística Global?
-- =============================================================================

-- 1. VERIFICAR TABLAS DEL MÓDULO DE LOGÍSTICA GLOBAL
-- =============================================================================

SELECT '🔍 PASO 1: Verificar tablas de Logística Global' as status;

-- ¿Existen las tablas del sistema de logística?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_routes') 
    THEN '✅ shipping_routes existe'
    ELSE '❌ shipping_routes NO EXISTE'
  END as tabla_rutas,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_tiers') 
    THEN '✅ shipping_tiers existe'
    ELSE '❌ shipping_tiers NO EXISTE'
  END as tabla_tiers,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_zones') 
    THEN '✅ shipping_zones existe'
    ELSE '❌ shipping_zones NO EXISTE'
  END as tabla_zonas,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_logistics_data') 
    THEN '✅ v_logistics_data (vista) existe'
    ELSE '❌ v_logistics_data (vista) NO EXISTE'
  END as vista_logistica;


-- =============================================================================
-- 2. VER CONFIGURACIÓN ACTUAL DE TARIFAS
-- =============================================================================

SELECT '🔍 PASO 2: Tarifas configuradas en shipping_tiers' as status;

-- Ver tarifas STANDARD y EXPRESS
SELECT 
  tier_type,
  tier_name,
  tramo_a_cost_per_kg as "Tramo A (USD/kg)",
  tramo_b_cost_per_lb as "Tramo B (USD/lb)",
  CASE 
    WHEN tier_type = 'standard' THEN '← Tarifa por defecto para B2B'
    WHEN tier_type = 'express' THEN 'Tarifa rápida (no para oversize)'
    ELSE 'Otro tipo'
  END as nota,
  is_active
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY tier_type;


-- =============================================================================
-- 3. COMPARAR NUESTRA FUNCIÓN vs FUNCIÓN DEL MÓDULO GLOBAL
-- =============================================================================

SELECT '🔍 PASO 3: Comparación de funciones' as status;

SELECT 
  '📋 NUESTRA FUNCIÓN' as tipo,
  'calculate_shipping_cost_for_selected_items' as nombre,
  '- Tabla: b2b_cart_items
- Fórmula: $11.05 + $5.82 por kg adicional (HARDCODEADA)
- No usa tablas configurables
- Solo calcula para items seleccionados' as caracteristicas,
  '❌ NO USA el módulo de Logística Global' as estado

UNION ALL

SELECT 
  '📋 FUNCIÓN DEL MÓDULO GLOBAL' as tipo,
  'fn_calculate_shipping_cost' as nombre,
  '- Vista: v_logistics_data
- Usa: shipping_routes (cost_per_kg, cost_per_lb)
- Usa: shipping_zones (recargos por zona)
- Soporta: STANDARD vs EXPRESS
- Soporta: productos OVERSIZE (peso volumétrico)
- Redondeo B2B correcto' as caracteristicas,
  '✅ SISTEMA COMPLETO Y CONFIGURABLE' as estado;


-- =============================================================================
-- 4. VERIFICAR SI EXISTEN FUNCIONES
-- =============================================================================

SELECT '🔍 PASO 4: Funciones instaladas' as status;

SELECT 
  routine_name as "Función",
  routine_type as "Tipo",
  CASE
    WHEN routine_name = 'calculate_shipping_cost_for_selected_items' 
      THEN '← Nuestra función (items seleccionados)'
   WHEN routine_name = 'fn_calculate_shipping_cost' 
      THEN '← Función del módulo Logística Global'
    ELSE 'Otra función'
  END as nota
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_shipping_cost_for_selected_items',
    'fn_calculate_shipping_cost'
  )
ORDER BY routine_name;


-- =============================================================================
-- 5. CALCULAR EJEMPLO CON AMBAS FUNCIONES
-- =============================================================================

SELECT '🔍 PASO 5: Comparación de resultados (2 kg de peso)' as status;

-- Nuestra fórmula hardcodeada
SELECT 
  'NUESTRA FÓRMULA HARDCODEADA' as metodo,
  2 as peso_kg,
  '$11.05 + (2-1) × $5.82 = $16.87' as calculo,
  11.05 + ((2 - 1) * 5.82) as costo_usd;


-- Fórmula del módulo global (si existe configuración)
DO $$
DECLARE
  v_tramo_a NUMERIC;
  v_tramo_b NUMERIC;
  v_peso_kg NUMERIC := 2;
  v_peso_lb NUMERIC := 2 * 2.20462;
  v_costo_total NUMERIC;
BEGIN
  SELECT 
    tramo_a_cost_per_kg,
    tramo_b_cost_per_lb
  INTO v_tramo_a, v_tramo_b
  FROM shipping_tiers
  WHERE tier_type = 'standard' 
    AND is_active = TRUE
  LIMIT 1;

  IF v_tramo_a IS NOT NULL THEN
    v_costo_total := (v_peso_kg * v_tramo_a) + (v_peso_lb * v_tramo_b);
    
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE 'FÓRMULA DEL MÓDULO LOGÍSTICA GLOBAL';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE 'Peso: % kg (% lb)', v_peso_kg, ROUND(v_peso_lb, 2);
    RAISE NOTICE 'Tramo A (China → Hub): % kg × $% = $%', 
      v_peso_kg, v_tramo_a, ROUND(v_peso_kg * v_tramo_a, 2);
    RAISE NOTICE 'Tramo B (Hub → Destino): % lb × $% = $%', 
      ROUND(v_peso_lb, 2), v_tramo_b, ROUND(v_peso_lb * v_tramo_b, 2);
    RAISE NOTICE 'TOTAL: $%', ROUND(v_costo_total, 2);
    RAISE NOTICE '═══════════════════════════════════════════════════════';
  ELSE
    RAISE NOTICE '❌ No hay tarifas configuradas en shipping_tiers';
  END IF;
END $$;


-- =============================================================================
-- 6. RESUMEN Y RECOMENDACIONES
-- =============================================================================

SELECT '📊 RESUMEN' as status;

SELECT 
  '❌ PROBLEMA DETECTADO' as resultado,
  'Nuestra función NO usa el módulo de Logística Global' as descripcion,
  'Tenemos fórmula hardcodeada ($11.05 + $5.82) que no se actualiza dinámicamente' as impacto,
  'Actualizar calculate_shipping_cost_for_selected_items() para usar shipping_tiers' as solucion;


-- =============================================================================
-- INFORMACIÓN ADICIONAL
-- =============================================================================

/*

🔴 PROBLEMA ENCONTRADO:

Nuestra función: calculate_shipping_cost_for_selected_items()
- Usa fórmula HARDCODEADA: $11.05 + $5.82 por kg adicional
- NO usa las tablas del módulo de Logística Global
- NO se puede configurar desde el admin panel

El módulo de Logística Global tiene:
- Tablas configurables: shipping_routes, shipping_tiers, shipping_zones
- Vista unificada: v_logistics_data
- Función completa: fn_calculate_shipping_cost()
- Admin Panel: AdminGlobalLogisticsPage.tsx para configurar tarifas


✅ SOLUCIÓN RECOMENDADA:

OPCIÓN A: Modificar nuestra función para usar shipping_tiers
  - Cambiar la fórmula hardcodeada por consulta a shipping_tiers
  - Mantener la misma interfaz (p_item_ids UUID[])
  - Usar tier_type = 'standard' por defecto

OPCIÓN B: Usar directamente fn_calculate_shipping_cost()
  - Crear wrapper que acepte array de IDs
  - Llamar fn_calculate_shipping_cost() por cada item
  - Sumar resultados

OPCIÓN C: Crear vista específica para carrito
  - CREATE VIEW v_cart_shipping_costs_dynamic...
  - Que use shipping_tiers automáticamente
  - Update useCartShippingCostView para usar la nueva vista


🎯 RECOMENDACIÓN FINAL:

OPCIÓN A es la mejor porque:
✅ Mantiene la misma interfaz (no rompe el frontend)
✅ Usa el sistema de tarifas configurable
✅ Solo requiere modificar la función SQL
✅ Se actualiza automáticamente cuando cambien las tarifas en el Admin Panel

*/
