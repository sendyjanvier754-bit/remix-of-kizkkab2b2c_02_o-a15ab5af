-- =============================================================================
-- ACTUALIZAR: calculate_shipping_cost_for_selected_items
-- Integrar con el módulo de Logística Global
-- =============================================================================
-- Esta actualización reemplaza la fórmula hardcodeada por el sistema
-- configurable de shipping_tiers
-- =============================================================================

DROP FUNCTION IF EXISTS calculate_shipping_cost_for_selected_items(UUID[]) CASCADE;

CREATE OR REPLACE FUNCTION calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_items INTEGER;
  v_shipping_cost NUMERIC;
  v_weight_rounded NUMERIC;
  v_tramo_a_cost_per_kg NUMERIC;
  v_tramo_b_cost_per_lb NUMERIC;
  v_peso_lb NUMERIC;
  v_cost_tramo_a NUMERIC;
  v_cost_tramo_b NUMERIC;
BEGIN
  -- Validar que se enviaron IDs
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL OR array_length(p_item_ids, 1) = 0 THEN
    RETURN json_build_object(
      'total_items', 0,
      'total_weight_kg', 0,
      'weight_rounded_kg', 0,
      'shipping_cost_usd', 0,
      'message', 'No items selected'
    );
  END IF;

  -- Calcular peso total SOLO de los items seleccionados
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COUNT(*)
  INTO v_total_weight, v_total_items
  FROM b2b_cart_items bci
  WHERE bci.id = ANY(p_item_ids);

  -- Si no hay peso o items, retornar 0
  IF v_total_items = 0 OR v_total_weight = 0 THEN
    RETURN json_build_object(
      'total_items', v_total_items,
      'total_weight_kg', 0,
      'weight_rounded_kg', 0,
      'shipping_cost_usd', 0,
      'message', 'No weight data available'
    );
  END IF;

  -- Redondear peso hacia arriba (requisito B2B)
  v_weight_rounded := CEIL(v_total_weight);

  -- 🔥 OBTENER TARIFAS DEL MÓDULO DE LOGÍSTICA GLOBAL
  -- Usar tier_type = 'standard' (por defecto para B2B)
  SELECT 
    tramo_a_cost_per_kg,
    tramo_b_cost_per_lb
  INTO v_tramo_a_cost_per_kg, v_tramo_b_cost_per_lb
  FROM shipping_tiers
  WHERE tier_type = 'standard' 
    AND is_active = TRUE
  LIMIT 1;

  -- Si no hay tarifas configuradas, usar valores por defecto (fallback)
  IF v_tramo_a_cost_per_kg IS NULL THEN
    v_tramo_a_cost_per_kg := 4.00;  -- Fallback Tramo A
    v_tramo_b_cost_per_lb := 2.50;  -- Fallback Tramo B
  END IF;

  -- Convertir kg a libras para Tramo B
  v_peso_lb := v_weight_rounded * 2.20462;

  -- 🔥 CALCULAR USANDO FÓRMULA DEL MÓDULO GLOBAL
  -- Tramo A: China → Hub (costo por KG)
  v_cost_tramo_a := v_weight_rounded * v_tramo_a_cost_per_kg;
  
  -- Tramo B: Hub → Destino (costo por LB)
  v_cost_tramo_b := v_peso_lb * v_tramo_b_cost_per_lb;
  
  -- Costo total
  v_shipping_cost := v_cost_tramo_a + v_cost_tramo_b;

  -- Retornar resultado
  RETURN json_build_object(
    'total_items', v_total_items,
    'total_weight_kg', ROUND(v_total_weight, 3),
    'weight_rounded_kg', v_weight_rounded,
    'weight_lb', ROUND(v_peso_lb, 2),
    'shipping_cost_usd', ROUND(v_shipping_cost, 2),
    'cost_breakdown', json_build_object(
      'tramo_a_usd', ROUND(v_cost_tramo_a, 2),
      'tramo_a_rate', v_tramo_a_cost_per_kg,
      'tramo_b_usd', ROUND(v_cost_tramo_b, 2),
      'tramo_b_rate', v_tramo_b_cost_per_lb
    ),
    'formula', 'Tramo A (kg × $' || v_tramo_a_cost_per_kg || ') + Tramo B (lb × $' || v_tramo_b_cost_per_lb || ')',
    'message', 'success'
  );
END;
$$ LANGUAGE plpgsql;

-- Comentario de la función
COMMENT ON FUNCTION calculate_shipping_cost_for_selected_items(UUID[]) IS 
  'Calcula costo de envío para items seleccionados del carrito B2B. 
   Usa tarifas del módulo de Logística Global (shipping_tiers).
   Aplica tier_type = ''standard'' por defecto.
   Fórmula: Tramo A (kg × cost_per_kg) + Tramo B (lb × cost_per_lb)';

-- Verificar que se actualizó correctamente
SELECT '✅ FUNCIÓN ACTUALIZADA' as status;

-- Probar con un ejemplo vacío
SELECT 
  '🧪 PRUEBA 1: Array vacío' as test,
  calculate_shipping_cost_for_selected_items(ARRAY[]::UUID[]) as resultado;

-- Ver qué tarifas está usando
SELECT 
  '📊 TARIFAS ACTUALES' as info,
  tier_type,
  tier_name,
  tramo_a_cost_per_kg as "Tramo A (USD/kg)",
  tramo_b_cost_per_lb as "Tramo B (USD/lb)",
  CASE 
    WHEN tier_type = 'standard' THEN '← La función usa esta tarifa'
    ELSE ''
  END as nota
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY tier_type;

-- =============================================================================
-- INFORMACIÓN IMPORTANTE
-- =============================================================================

/*

✅ CAMBIOS REALIZADOS:

1. Se eliminó la fórmula hardcodeada: $11.05 + $5.82
2. Ahora consulta shipping_tiers para obtener tarifas dinámicas
3. Usa tier_type = 'standard' (apropiado para B2B)
4. Aplica la fórmula del módulo global:
   - Tramo A: peso_kg × tramo_a_cost_per_kg
   - Tramo B: peso_lb × tramo_b_cost_per_lb
   - Total: Tramo A + Tramo B

5. Incluye fallback si no hay tarifas configuradas:
   - Tramo A: $4.00/kg
   - Tramo B: $2.50/lb

6. Retorna desglose de costos para debugging


🎯 BENEFICIOS:

✅ Centralizado: Usa el mismo sistema que todo el resto de la aplicación
✅ Configurable: Cambios en Admin Panel se reflejan automáticamente
✅ Consistente: Misma lógica que fn_calculate_shipping_cost()
✅ Transparente: Retorna desglose de costos (Tramo A + Tramo B)


📝 PRÓXIMOS PASOS:

1. Ejecuta este script en SQL Editor
2. Verifica que la función se actualizó correctamente
3. Abre el carrito B2B en tu aplicación
4. Selecciona algunos productos
5. El costo de envío ahora usa las tarifas configurables

Si quieres cambiar las tarifas:
→ Ve a Admin Panel > Global Logistics
→ Edita las tarifas en shipping_tiers
→ ¡El carrito se actualiza automáticamente!


🔄 COMPARACIÓN:

ANTES:
- Fórmula: $11.05 + (kg - 1) × $5.82
- Hardcodeada en 20+ archivos
- Imposible de cambiar sin editar código

DESPUÉS:
- Fórmula: (kg × $X) + (lb × $Y)
- Configurable desde Admin Panel
- Se actualiza en tiempo real


💡 NOTA SOBRE LOS COSTOS:

La fórmula anterior ($11.05 + $5.82) era una simplificación.
El módulo de Logística Global usa un sistema más preciso:
- Tramo A: China → USA (marítimo/aéreo)
- Tramo B: USA → Haití (terrestre/aéreo local)

Esto permite configurar diferentes rutas y tipos de envío
(STANDARD vs EXPRESS) según las necesidades del negocio.

*/
