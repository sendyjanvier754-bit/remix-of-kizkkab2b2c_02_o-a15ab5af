-- =============================================================================
-- ACTUALIZAR v_cart_shipping_costs PARA USAR bci.peso_kg
-- =============================================================================
-- La vista debe usar el peso_kg guardado en b2b_cart_items
-- en lugar de calcular desde products/product_variants
-- =============================================================================

DROP VIEW IF EXISTS public.v_cart_shipping_costs CASCADE;

CREATE OR REPLACE VIEW public.v_cart_shipping_costs AS
SELECT 
  bc.id as cart_id,
  bc.buyer_user_id,
  COUNT(bci.id) as total_items,
  SUM(bci.quantity) as total_quantity,
  -- Usar peso_kg guardado en cart_items (calculado al agregar)
  SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as total_weight_kg,
  CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity))::INTEGER as weight_rounded_kg,
  -- Calcular costo de envío
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as total_cost_with_type,
  CASE 
    WHEN SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) = 0 THEN 0
    WHEN CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(SUM(COALESCE(bci.peso_kg, 0) * bci.quantity)) - 1) * 5.82)
  END as base_cost,
  0 as oversize_surcharge,
  0 as dimensional_surcharge,
  0 as extra_cost,
  'STANDARD' as shipping_type_name,
  'Envío Estándar' as shipping_type_display,
  0 as volume_m3
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid()  -- Filtro RLS automático
  AND bc.status = 'open'
GROUP BY bc.id, bc.buyer_user_id;

COMMENT ON VIEW public.v_cart_shipping_costs IS 
  'Vista que calcula el costo de envío usando peso_kg guardado en b2b_cart_items. Usa RLS con auth.uid() para filtrar por usuario.';

-- Habilitar RLS en la vista (hereda de las tablas subyacentes)
ALTER VIEW public.v_cart_shipping_costs SET (security_invoker = true);

-- Verificar que funciona
SELECT 
  '✅ VISTA ACTUALIZADA' as info,
  cart_id,
  buyer_user_id,
  total_items,
  total_weight_kg,
  weight_rounded_kg,
  total_cost_with_type as costo_envio
FROM v_cart_shipping_costs;
