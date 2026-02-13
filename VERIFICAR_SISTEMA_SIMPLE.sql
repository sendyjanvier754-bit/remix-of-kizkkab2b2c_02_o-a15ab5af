-- =============================================================================
-- VERIFICACIÓN SISTEMA DE TARIFAS REALES (Para Supabase Dashboard)
-- =============================================================================
-- Copia y pega este script en el SQL Editor de Supabase
-- =============================================================================

-- TEST 1: ¿Existe la función calculate_shipping_cost_cart?
-- ============================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'calculate_shipping_cost_cart'
    ) THEN '✅ Función calculate_shipping_cost_cart EXISTE'
    ELSE '❌ Función calculate_shipping_cost_cart NO EXISTE'
  END as "TEST 1: Función Principal";

-- TEST 2: ¿Tabla shipping_tiers tiene datos?
-- ===========================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ shipping_tiers tiene ' || COUNT(*) || ' registros'
    ELSE '⚠️  shipping_tiers está VACÍA - necesitas ejecutar CONFIGURAR_TARIFAS_REALES.sql'
  END as "TEST 2: Shipping Tiers"
FROM shipping_tiers;

-- TEST 3: ¿Tabla shipping_routes tiene datos?
-- ============================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ shipping_routes tiene ' || COUNT(*) || ' registros'
    ELSE '⚠️  shipping_routes está VACÍA - necesitas ejecutar CONFIGURAR_TARIFAS_REALES.sql'
  END as "TEST 3: Shipping Routes"
FROM shipping_routes;

-- TEST 4: ¿Tabla transportation_hubs tiene datos?
-- ===============================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ transportation_hubs tiene ' || COUNT(*) || ' registros'
    ELSE '⚠️  transportation_hubs está VACÍA - necesitas ejecutar CONFIGURAR_TARIFAS_REALES.sql'
  END as "TEST 4: Transportation Hubs"
FROM transportation_hubs;

-- TEST 5: ¿Tabla destination_countries tiene datos?
-- ==================================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ destination_countries tiene ' || COUNT(*) || ' registros'
    ELSE '⚠️  destination_countries está VACÍA - necesitas ejecutar CONFIGURAR_TARIFAS_REALES.sql'
  END as "TEST 5: Destination Countries"
FROM destination_countries;

-- TEST 6: Ver detalles de las tarifas configuradas
-- =================================================
SELECT 
  name as "Tier",
  tramo_a_cost_per_kg as "Costo/kg Tramo A (China→USA)",
  tramo_b_cost_per_lb as "Costo/lb Tramo B (USA→Destino)",
  is_active as "Activo"
FROM shipping_tiers
ORDER BY name;

-- TEST 7: Ver rutas disponibles
-- ==============================
SELECT 
  sr.id,
  origin.code || ' → ' || destination.code as "Ruta",
  origin.name as "Origen",
  destination.name as "Destino",
  sr.distance_km as "Distancia (km)",
  sr.is_active as "Activa"
FROM shipping_routes sr
JOIN transportation_hubs origin ON sr.origin_hub_id = origin.id
JOIN transportation_hubs destination ON sr.destination_hub_id = destination.id
WHERE sr.is_active = TRUE
ORDER BY sr.id;

-- =============================================================================
-- RESUMEN: ¿Qué necesitas hacer?
-- =============================================================================

SELECT 
  CASE
    -- Caso ideal: todo existe
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_shipping_cost_cart')
     AND (SELECT COUNT(*) FROM shipping_tiers) > 0
     AND (SELECT COUNT(*) FROM shipping_routes) > 0
     AND (SELECT COUNT(*) FROM transportation_hubs) > 0
    THEN '✅ SISTEMA COMPLETO - Puedes instalar los triggers directamente'
    
    -- Función existe pero faltan datos
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_shipping_cost_cart')
     AND ((SELECT COUNT(*) FROM shipping_tiers) = 0 OR (SELECT COUNT(*) FROM shipping_routes) = 0)
    THEN '⚠️  NECESITAS CONFIGURAR DATOS - Ejecuta CONFIGURAR_TARIFAS_REALES.sql'
    
    -- Función no existe
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_shipping_cost_cart')
    THEN '❌ FALTA FUNCIÓN - Busca la migración que crea calculate_shipping_cost_cart()'
    
    ELSE '⚠️  ESTADO DESCONOCIDO - Revisa los resultados arriba'
  END as "VEREDICTO FINAL";

-- =============================================================================
-- INSTRUCCIONES SEGÚN EL RESULTADO:
-- =============================================================================

/*

CASO A: ✅ SISTEMA COMPLETO
---------------------------
→ Salta directamente a instalar los triggers
→ Ejecuta: TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql
→ Luego: TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql

CASO B: ⚠️ NECESITAS CONFIGURAR DATOS
-------------------------------------
→ Ejecuta: CONFIGURAR_TARIFAS_REALES.sql
→ Vuelve a ejecutar este script para verificar
→ Luego instala los triggers

CASO C: ❌ FALTA FUNCIÓN
------------------------
→ Busca en tus migraciones el archivo que crea calculate_shipping_cost_cart()
→ Posibles nombres:
  * *shipping_cost*.sql
  * *dynamic_pricing*.sql
  * 20260*_shipping_functions.sql
→ Ejecútalo primero
→ Si no lo encuentras, avísame para crearlo

*/
