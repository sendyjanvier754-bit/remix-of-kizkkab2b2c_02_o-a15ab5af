-- =============================================================================
-- PASO 1: VERIFICACIÓN PREVIA
-- =============================================================================
-- Ejecuta este script ANTES de instalar los triggers para verificar que tu
-- sistema tiene todo lo necesario para usar tarifas reales
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  VERIFICACIÓN: Sistema de Tarifas Reales                               ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- =============================================================================
-- TEST 1: Verificar que existe la función de cálculo real
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1. VERIFICAR FUNCIÓN calculate_shipping_cost_cart()'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'calculate_shipping_cost_cart'
    ) THEN '✅ Función existe'
    ELSE '❌ Función NO existe - NECESITAS CREARLA'
  END as status,
  routine_schema as schema,
  routine_type as type
FROM information_schema.routines 
WHERE routine_name = 'calculate_shipping_cost_cart'
UNION ALL
SELECT 
  '❌ Función NO existe - NECESITAS CREARLA',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'calculate_shipping_cost_cart'
);

\echo ''

-- =============================================================================
-- TEST 2: Verificar tablas de configuración de tarifas
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2. VERIFICAR TABLAS DE CONFIGURACIÓN'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Shipping Tiers
SELECT 
  '🎯 shipping_tiers' as tabla,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*) || ' registros'
    ELSE '⚠️  Tabla vacía - necesitas agregar tiers'
  END as estado,
  STRING_AGG(name, ', ') as tiers_disponibles
FROM shipping_tiers;

-- Shipping Routes
SELECT 
  '🛣️  shipping_routes' as tabla,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*) || ' rutas'
    ELSE '⚠️  Tabla vacía - necesitas agregar rutas'
  END as estado,
  NULL as tiers_disponibles
FROM shipping_routes;

-- Transportation Hubs
SELECT 
  '🏭 transportation_hubs' as tabla,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*) || ' hubs'
    ELSE '⚠️  Tabla vacía - necesitas agregar hubs'
  END as estado,
  STRING_AGG(code, ', ') as hubs_disponibles
FROM transportation_hubs;

-- Destination Countries
SELECT 
  '🌍 destination_countries' as tabla,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*) || ' países'
    ELSE '⚠️  Tabla vacía - necesitas agregar países'
  END as estado,
  STRING_AGG(code, ', ') as paises_disponibles
FROM destination_countries;

\echo ''

-- =============================================================================
-- TEST 3: Ver configuración actual de shipping_tiers
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3. CONFIGURACIÓN ACTUAL DE TARIFAS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  id,
  name as "Tier",
  tramo_a_cost_per_kg as "Tramo A (USD/kg)",
  tramo_b_cost_per_lb as "Tramo B (USD/lb)",
  final_delivery_surcharge as "Surcharge Final",
  is_active
FROM shipping_tiers
ORDER BY name;

\echo ''
\echo 'Si esta tabla está vacía, necesitas ejecutar:'
\echo '  → CONFIGURAR_TARIFAS_REALES.sql (próximo paso)'
\echo ''

-- =============================================================================
-- TEST 4: Probar la función con datos de prueba
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4. TEST DE FUNCIÓN (si existe)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

DO $$
DECLARE
  v_route_id UUID;
  v_has_function BOOLEAN;
BEGIN
  -- Verificar si existe la función
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'calculate_shipping_cost_cart'
  ) INTO v_has_function;
  
  IF v_has_function THEN
    -- Obtener una ruta de prueba
    SELECT id INTO v_route_id
    FROM shipping_routes
    LIMIT 1;
    
    IF v_route_id IS NOT NULL THEN
      RAISE NOTICE 'Probando función con ruta: %', v_route_id;
      RAISE NOTICE 'Peso de prueba: 1.5 kg';
      RAISE NOTICE '';
      RAISE NOTICE 'Ejecuta este query para ver el resultado:';
      RAISE NOTICE 'SELECT * FROM calculate_shipping_cost_cart(';
      RAISE NOTICE '  ''%''::uuid,', v_route_id;
      RAISE NOTICE '  1.5,';
      RAISE NOTICE '  NULL,';
      RAISE NOTICE '  FALSE,';
      RAISE NOTICE '  NULL, NULL, NULL';
      RAISE NOTICE ');';
    ELSE
      RAISE NOTICE '⚠️  No hay rutas configuradas para probar';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Función calculate_shipping_cost_cart NO existe';
    RAISE NOTICE 'Necesitas crearla antes de continuar';
  END IF;
END $$;

\echo ''

-- =============================================================================
-- TEST 5: Comparar fórmula simple vs tarifa real (si todo existe)
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5. COMPARACIÓN: Fórmula Simple vs Tarifa Real'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

DO $$
DECLARE
  v_route_id UUID;
  v_has_function BOOLEAN;
  v_test_weights NUMERIC[] := ARRAY[0.5, 1.0, 2.0, 3.5, 5.0];
  v_weight NUMERIC;
  v_simple_cost NUMERIC;
  v_real_cost NUMERIC;
BEGIN
  -- Verificar si existe la función
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'calculate_shipping_cost_cart'
  ) INTO v_has_function;
  
  IF NOT v_has_function THEN
    RAISE NOTICE '⚠️  No se puede realizar comparación porque la función NO existe';
    RETURN;
  END IF;
  
  -- Obtener una ruta de prueba
  SELECT id INTO v_route_id FROM shipping_routes LIMIT 1;
  
  IF v_route_id IS NULL THEN
    RAISE NOTICE '⚠️  No hay rutas configuradas para comparar';
    RETURN;
  END IF;
  
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  Peso (kg)  │  Fórmula Simple  │  Tarifa Real  │  Diferencia ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
  
  FOREACH v_weight IN ARRAY v_test_weights
  LOOP
    -- Calcular con fórmula simple
    IF v_weight = 0 THEN
      v_simple_cost := 0;
    ELSIF CEIL(v_weight) <= 1 THEN
      v_simple_cost := 11.05;
    ELSE
      v_simple_cost := 11.05 + ((CEIL(v_weight) - 1) * 5.82);
    END IF;
    
    -- Calcular con tarifa real
    BEGIN
      SELECT (result->>'total_cost_with_type')::NUMERIC INTO v_real_cost
      FROM calculate_shipping_cost_cart(
        v_route_id,
        v_weight,
        NULL,
        FALSE,
        NULL, NULL, NULL
      ) as result;
    EXCEPTION
      WHEN OTHERS THEN
        v_real_cost := NULL;
    END;
    
    IF v_real_cost IS NOT NULL THEN
      RAISE NOTICE '║  %  │    $%    │   $%   │   $%  ║', 
        LPAD(v_weight::TEXT, 7, ' '),
        LPAD(ROUND(v_simple_cost, 2)::TEXT, 13, ' '),
        LPAD(ROUND(v_real_cost, 2)::TEXT, 11, ' '),
        LPAD(ROUND(v_real_cost - v_simple_cost, 2)::TEXT, 11, ' ');
    END IF;
  END LOOP;
  
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
END $$;

\echo ''

-- =============================================================================
-- RESUMEN Y RECOMENDACIONES
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  RESUMEN Y PRÓXIMOS PASOS                                              ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

DO $$
DECLARE
  v_has_function BOOLEAN;
  v_has_tiers BOOLEAN;
  v_has_routes BOOLEAN;
  v_has_hubs BOOLEAN;
  v_ready BOOLEAN := TRUE;
BEGIN
  -- Verificar componentes
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'calculate_shipping_cost_cart'
  ) INTO v_has_function;
  
  SELECT EXISTS (SELECT 1 FROM shipping_tiers LIMIT 1) INTO v_has_tiers;
  SELECT EXISTS (SELECT 1 FROM shipping_routes LIMIT 1) INTO v_has_routes;
  SELECT EXISTS (SELECT 1 FROM transportation_hubs LIMIT 1) INTO v_has_hubs;
  
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  CHECKLIST DE REQUISITOS                                       ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
  
  IF v_has_function THEN
    RAISE NOTICE '║  ✅ Función calculate_shipping_cost_cart existe                ║';
  ELSE
    RAISE NOTICE '║  ❌ Función calculate_shipping_cost_cart NO existe             ║';
    v_ready := FALSE;
  END IF;
  
  IF v_has_tiers THEN
    RAISE NOTICE '║  ✅ Shipping tiers configurados                                ║';
  ELSE
    RAISE NOTICE '║  ⚠️  Shipping tiers vacíos (usar valores default)             ║';
  END IF;
  
  IF v_has_routes THEN
    RAISE NOTICE '║  ✅ Rutas de envío configuradas                                ║';
  ELSE
    RAISE NOTICE '║  ⚠️  Rutas vacías (crear ruta default)                        ║';
  END IF;
  
  IF v_has_hubs THEN
    RAISE NOTICE '║  ✅ Transportation hubs configurados                           ║';
  ELSE
    RAISE NOTICE '║  ⚠️  Hubs vacíos (crear hubs básicos)                         ║';
  END IF;
  
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  IF v_ready AND v_has_tiers AND v_has_routes AND v_has_hubs THEN
    RAISE NOTICE '✅ ¡SISTEMA LISTO! Puedes instalar los triggers:';
    RAISE NOTICE '   → psql -f TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql';
  ELSE
    RAISE NOTICE '⚠️  NECESITAS CONFIGURAR ANTES DE CONTINUAR:';
    RAISE NOTICE '';
    
    IF NOT v_has_function THEN
      RAISE NOTICE '   1. Busca el script que crea calculate_shipping_cost_cart()';
      RAISE NOTICE '      Posibles nombres:';
      RAISE NOTICE '      - MIGRACION_ACTUALIZAR_SHIPPING_FUNCTIONS*.sql';
      RAISE NOTICE '      - 20260*_shipping_cost_functions.sql';
      RAISE NOTICE '      O usa: CREAR_FUNCION_CALCULATE_SHIPPING_COST_CART.sql';
      RAISE NOTICE '';
    END IF;
    
    IF NOT v_has_tiers OR NOT v_has_routes OR NOT v_has_hubs THEN
      RAISE NOTICE '   2. Ejecuta: CONFIGURAR_TARIFAS_REALES.sql';
      RAISE NOTICE '      (siguiente paso - ya lo estoy creando)';
      RAISE NOTICE '';
    END IF;
    
    RAISE NOTICE '   3. Vuelve a ejecutar este script para verificar';
    RAISE NOTICE '   4. Cuando todo esté ✅, instala los triggers';
  END IF;
  
  RAISE NOTICE '';
END $$;

\echo '════════════════════════════════════════════════════════════════════════'
