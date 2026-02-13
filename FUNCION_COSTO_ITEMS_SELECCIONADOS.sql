-- =============================================================================
-- FUNCIÓN: Calcular costo de envío SOLO para items seleccionados
-- =============================================================================
-- Esta función recibe una lista de IDs de cart_items y calcula el costo
-- de envío basado únicamente en esos items (los que tienen checkbox marcado)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_items INTEGER;
  v_shipping_cost NUMERIC;
  v_weight_rounded NUMERIC;
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

  -- Redondear peso hacia arriba
  v_weight_rounded := CEIL(v_total_weight);

  -- Calcular costo de envío con la fórmula actual
  -- Primer kg: $11.05, cada kg adicional: $5.82
  IF v_weight_rounded <= 1 THEN
    v_shipping_cost := 11.05;
  ELSE
    v_shipping_cost := 11.05 + ((v_weight_rounded - 1) * 5.82);
  END IF;

  -- Retornar resultado
  RETURN json_build_object(
    'total_items', v_total_items,
    'total_weight_kg', ROUND(v_total_weight, 3),
    'weight_rounded_kg', v_weight_rounded,
    'shipping_cost_usd', ROUND(v_shipping_cost, 2),
    'formula', '11.05 + (kg_adicionales × 5.82)',
    'message', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION calculate_shipping_cost_for_selected_items IS 
  'Calcula costo de envío SOLO para los cart items seleccionados.
   Parámetros:
   - p_item_ids: Array de UUIDs de b2b_cart_items seleccionados
   Retorna JSON con total_items, total_weight_kg, weight_rounded_kg, shipping_cost_usd';

-- =============================================================================
-- TEST: Probar la función con items de tu carrito
-- =============================================================================

-- Primero, ver tus items actuales
SELECT 
  '📦 TUS ITEMS ACTUALES (para testing)' as info,
  bci.id,
  bci.sku,
  bci.nombre,
  bci.quantity,
  bci.peso_kg,
  (bci.peso_kg * bci.quantity) as peso_total
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid()
  AND bc.status = 'open'
ORDER BY bci.created_at DESC
LIMIT 10;

-- Test 1: Calcular costo para TODOS los items
-- (Reemplaza los IDs con los de tu carrito después de ejecutar el query anterior)
/*
SELECT calculate_shipping_cost_for_selected_items(
  ARRAY[
    'id-item-1'::uuid,
    'id-item-2'::uuid,
    'id-item-3'::uuid
  ]::uuid[]
) as resultado;
*/

-- Test 2: Calcular para SOLO 1 item (el primero)
/*
SELECT calculate_shipping_cost_for_selected_items(
  ARRAY(
    SELECT id 
    FROM b2b_cart_items bci
    JOIN b2b_carts bc ON bci.cart_id = bc.id
    WHERE bc.buyer_user_id = auth.uid()
      AND bc.status = 'open'
    LIMIT 1
  )
) as "Costo para 1 item";
*/

-- Test 3: Array vacío (debe retornar 0)
SELECT calculate_shipping_cost_for_selected_items(ARRAY[]::uuid[]) as "Array vacío";

-- =============================================================================
-- PRÓXIMOS PASOS:
-- =============================================================================

/*

1. ✅ Ejecuta este script en SQL Editor de Supabase

2. Verás la lista de tus items actuales

3. Modifica el hook en TypeScript para usar esta función:
   → Archivo: src/hooks/useCartShippingCostView.ts
   → Agregar parámetro: selectedItemIds
   → Llamar a: supabase.rpc('calculate_shipping_cost_for_selected_items', { p_item_ids: selectedItemIds })

4. En SellerCartPage.tsx:
   → Pasar los IDs seleccionados: useCartShippingCostView(b2bSelectedIds)
   → El costo se actualizará automáticamente cuando cambies la selección

*/
