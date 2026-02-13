-- =============================================================================
-- SCRIPT DE VERIFICACIÓN Y TESTING
-- =============================================================================
-- 
-- Ejecuta este script DESPUÉS de instalar los triggers para verificar que
-- todo funciona correctamente
--
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  VERIFICACIÓN: Triggers de Peso y Costo de Envío Automáticos          ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- =============================================================================
-- TEST 1: Verificar que los triggers existen
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1. VERIFICANDO TRIGGERS INSTALADOS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  trigger_name as "Trigger",
  event_object_table as "Tabla",
  action_timing as "Timing",
  event_manipulation as "Evento"
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_calculate_cart_item_weight',
  'trigger_update_cart_shipping'
)
ORDER BY event_object_table, trigger_name;

\echo ''
\echo '✅ Debe mostrar 4 triggers:'
\echo '   - trigger_calculate_cart_item_weight en b2b_cart_items'
\echo '   - trigger_calculate_cart_item_weight en b2c_cart_items'
\echo '   - trigger_update_cart_shipping en b2b_cart_items'
\echo '   - trigger_update_cart_shipping en b2c_cart_items'
\echo ''

-- =============================================================================
-- TEST 2: Verificar columnas agregadas
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2. VERIFICANDO COLUMNAS AGREGADAS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  table_name as "Tabla",
  column_name as "Columna",
  data_type as "Tipo",
  CASE 
    WHEN is_nullable = 'YES' THEN 'NULL'
    ELSE 'NOT NULL'
  END as "Nullable"
FROM information_schema.columns
WHERE table_name IN ('b2b_carts', 'b2c_carts', 'b2b_cart_items', 'b2c_cart_items')
  AND column_name IN ('peso_kg', 'total_weight_kg', 'shipping_cost_usd', 'last_shipping_update')
ORDER BY table_name, column_name;

\echo ''
\echo '✅ Debe mostrar:'
\echo '   - peso_kg en b2b_cart_items y b2c_cart_items'
\echo '   - total_weight_kg en b2b_carts y b2c_carts'
\echo '   - shipping_cost_usd en b2b_carts y b2c_carts'
\echo '   - last_shipping_update en b2b_carts y b2c_carts'
\echo ''

-- =============================================================================
-- TEST 3: Estado actual de carritos
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3. ESTADO ACTUAL DE CARRITOS B2B'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  bc.id,
  COUNT(bci.id) as "Items",
  ROUND(bc.total_weight_kg::numeric, 2) as "Peso (kg)",
  ROUND(bc.shipping_cost_usd::numeric, 2) as "Costo ($)",
  TO_CHAR(bc.last_shipping_update, 'YYYY-MM-DD HH24:MI:SS') as "Actualizado"
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.total_weight_kg, bc.shipping_cost_usd, bc.last_shipping_update
ORDER BY bc.created_at DESC
LIMIT 5;

\echo ''

-- =============================================================================
-- TEST 4: Verificar peso de items individuales
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4. ITEMS EN CARRITOS (verificar peso_kg calculado)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  bci.id,
  LEFT(bci.nombre, 30) as "Producto",
  bci.quantity as "Qty",
  ROUND(bci.peso_kg::numeric, 3) as "Peso/item (kg)",
  ROUND((bci.peso_kg * bci.quantity)::numeric, 3) as "Peso Total (kg)",
  CASE 
    WHEN bci.peso_kg IS NOT NULL AND bci.peso_kg > 0 
    THEN '✅'
    ELSE '❌'
  END as "Estado"
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.status = 'open'
ORDER BY bci.created_at DESC
LIMIT 10;

\echo ''
\echo '✅ Todos los items deben tener peso_kg > 0'
\echo ''

-- =============================================================================
-- TEST 5: Probar trigger con inserción real
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5. TEST EN VIVO: Insertar item de prueba'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Guardar estado antes del test
CREATE TEMP TABLE pre_test_state AS
SELECT 
  bc.id,
  COUNT(bci.id) as item_count,
  bc.total_weight_kg,
  bc.shipping_cost_usd
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.total_weight_kg, bc.shipping_cost_usd;

-- Insertar item de prueba
DO $$
DECLARE
  v_cart_id UUID;
  v_product_id UUID;
  v_test_item_id UUID;
BEGIN
  -- Obtener carrito y producto
  SELECT bc.id INTO v_cart_id
  FROM b2b_carts bc
  WHERE bc.status = 'open'
  LIMIT 1;
  
  SELECT p.id INTO v_product_id
  FROM products p
  WHERE p.is_active = TRUE
  LIMIT 1;
  
  IF v_cart_id IS NOT NULL AND v_product_id IS NOT NULL THEN
    -- Insertar item SIN especificar peso_kg
    INSERT INTO b2b_cart_items (
      cart_id,
      product_id,
      sku,
      nombre,
      quantity,
      unit_price,
      total_price
    )
    VALUES (
      v_cart_id,
      v_product_id,
      'TEST-VERIFICACION-' || FLOOR(RANDOM() * 100000),
      'Item de Prueba para Verificación',
      1,
      5.00,
      5.00
    )
    RETURNING id INTO v_test_item_id;
    
    RAISE NOTICE 'Item de prueba insertado con ID: %', v_test_item_id;
  ELSE
    RAISE NOTICE 'No hay carritos o productos disponibles para test';
  END IF;
END $$;

\echo ''
\echo 'Item de prueba insertado. Verificando resultados...'
\echo ''

-- Verificar que el peso se calculó automáticamente
SELECT 
  '🧪 RESULTADO: Item insertado' as test,
  bci.id,
  bci.nombre,
  bci.quantity,
  ROUND(bci.peso_kg::numeric, 3) as "Peso Calculado (kg)",
  CASE 
    WHEN bci.peso_kg IS NOT NULL AND bci.peso_kg > 0 
    THEN '✅ TRIGGER FUNCIONÓ'
    ELSE '❌ TRIGGER FALLÓ'
  END as resultado,
  TO_CHAR(bci.created_at, 'HH24:MI:SS') as "Hora Creación"
FROM b2b_cart_items bci
WHERE bci.sku LIKE 'TEST-VERIFICACION-%'
ORDER BY bci.created_at DESC
LIMIT 1;

\echo ''

-- Verificar que el carrito se actualizó
SELECT 
  '🧪 RESULTADO: Carrito actualizado' as test,
  post.id as cart_id,
  pre.item_count as "Items Antes",
  post.item_count as "Items Después",
  ROUND(pre.total_weight_kg::numeric, 3) as "Peso Antes (kg)",
  ROUND(post.total_weight_kg::numeric, 3) as "Peso Después (kg)",
  ROUND(pre.shipping_cost_usd::numeric, 2) as "Costo Antes ($)",
  ROUND(post.shipping_cost_usd::numeric, 2) as "Costo Después ($)",
  CASE 
    WHEN post.total_weight_kg > pre.total_weight_kg 
    THEN '✅ CARRITO ACTUALIZADO'
    ELSE '❌ CARRITO NO CAMBIÓ'
  END as resultado
FROM pre_test_state pre
JOIN (
  SELECT 
    bc.id,
    COUNT(bci.id) as item_count,
    bc.total_weight_kg,
    bc.shipping_cost_usd
  FROM b2b_carts bc
  LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
  WHERE bc.status = 'open'
  GROUP BY bc.id, bc.total_weight_kg, bc.shipping_cost_usd
) post ON pre.id = post.id
WHERE EXISTS (
  SELECT 1 
  FROM b2b_cart_items bci 
  WHERE bci.cart_id = pre.id 
    AND bci.sku LIKE 'TEST-VERIFICACION-%'
);

\echo ''

-- =============================================================================
-- TEST 6: Limpiar datos de prueba
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '6. LIMPIANDO DATOS DE PRUEBA'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

DELETE FROM b2b_cart_items WHERE sku LIKE 'TEST-VERIFICACION-%';

SELECT '✅ Items de prueba eliminados' as status;

\echo ''

-- =============================================================================
-- TEST 7: Verificar vista original (debe seguir funcionando)
-- =============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '7. VERIFICANDO VISTA v_cart_shipping_costs'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  cart_id,
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 2) as "Peso (kg)",
  ROUND(total_cost_with_type::numeric, 2) as "Costo ($)",
  shipping_type_display as "Tipo Envío"
FROM v_cart_shipping_costs
LIMIT 5;

\echo ''
\echo '✅ La vista debe seguir funcionando y mostrar los mismos valores'
\echo '   que las columnas calculadas en b2b_carts'
\echo ''

-- =============================================================================
-- RESUMEN FINAL
-- =============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  RESUMEN DE VERIFICACIÓN                                               ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

DO $$
DECLARE
  v_trigger_count INT;
  v_column_count INT;
  v_items_without_weight INT;
BEGIN
  -- Contar triggers
  SELECT COUNT(*)
  INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN (
    'trigger_calculate_cart_item_weight',
    'trigger_update_cart_shipping'
  );
  
  -- Contar columnas
  SELECT COUNT(*)
  INTO v_column_count
  FROM information_schema.columns
  WHERE table_name IN ('b2b_carts', 'b2c_carts', 'b2b_cart_items', 'b2c_cart_items')
    AND column_name IN ('peso_kg', 'total_weight_kg', 'shipping_cost_usd', 'last_shipping_update');
  
  -- Contar items sin peso
  SELECT COUNT(*)
  INTO v_items_without_weight
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.status = 'open'
    AND (bci.peso_kg IS NULL OR bci.peso_kg = 0);
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Triggers instalados: % / 4', v_trigger_count;
  RAISE NOTICE 'Columnas agregadas: % / ~10', v_column_count;
  RAISE NOTICE 'Items sin peso en carritos abiertos: %', v_items_without_weight;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  IF v_trigger_count = 4 AND v_column_count >= 8 AND v_items_without_weight = 0 THEN
    RAISE NOTICE '✅✅✅ INSTALACIÓN EXITOSA ✅✅✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Todos los triggers están instalados correctamente.';
    RAISE NOTICE 'Los items del carrito se calcularán automáticamente.';
    RAISE NOTICE 'El costo de envío se actualizará en tiempo real.';
  ELSE
    RAISE NOTICE '⚠️  ADVERTENCIA: Revisa los resultados arriba';
    IF v_trigger_count < 4 THEN
      RAISE NOTICE '   → Faltan triggers por instalar';
    END IF;
    IF v_column_count < 8 THEN
      RAISE NOTICE '   → Faltan columnas por agregar';
    END IF;
    IF v_items_without_weight > 0 THEN
      RAISE NOTICE '   → Ejecuta ACTUALIZAR_PESO_ITEMS_AHORA.sql';
    END IF;
  END IF;
  
  RAISE NOTICE '';
END $$;

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SIGUIENTES PASOS                                                      ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''
\echo 'Si hay items sin peso:'
\echo '  1. Ejecuta: ACTUALIZAR_PESO_ITEMS_AHORA.sql'
\echo ''
\echo 'Para probar en frontend:'
\echo '  1. Agrega un producto al carrito'
\echo '  2. Verifica que el costo de envío se muestra inmediatamente'
\echo '  3. Abre la consola del navegador y verifica peso_kg > 0'
\echo ''
\echo 'Para ver el costo directamente desde el carrito:'
\echo '  SELECT id, total_weight_kg, shipping_cost_usd'
\echo '  FROM b2b_carts'
\echo '  WHERE buyer_user_id = auth.uid() AND status = '\''open'\'';'
\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
