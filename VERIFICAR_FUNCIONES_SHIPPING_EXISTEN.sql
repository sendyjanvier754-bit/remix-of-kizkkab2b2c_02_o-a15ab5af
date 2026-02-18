-- ============================================================================
-- VERIFICAR QUÉ FUNCIONES DE SHIPPING EXISTEN EN LA BASE DE DATOS
-- ============================================================================

-- Listar TODAS las funciones relacionadas con shipping
SELECT 
  '🔍 FUNCIONES DE SHIPPING DISPONIBLES' as info,
  r.routine_name as nombre_funcion,
  r.routine_type as tipo,
  STRING_AGG(
    p.parameter_name || ': ' || p.data_type, 
    ', ' ORDER BY p.ordinal_position
  ) as parametros
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p 
  ON r.specific_name = p.specific_name 
  AND p.parameter_mode = 'IN'
WHERE r.routine_schema = 'public'
  AND r.routine_name ILIKE '%shipping%'
GROUP BY r.routine_name, r.routine_type
ORDER BY r.routine_name;

-- Verificar específicamente las funciones críticas
SELECT 
  '⚠️ FUNCIONES CRÍTICAS' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'calculate_shipping_cost_cart'
    ) THEN '✅ calculate_shipping_cost_cart EXISTE'
    ELSE '❌ calculate_shipping_cost_cart NO EXISTE'
  END as estado_1,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'calculate_shipping_cost_for_selected_items'
    ) THEN '✅ calculate_shipping_cost_for_selected_items EXISTE'
    ELSE '❌ calculate_shipping_cost_for_selected_items NO EXISTE'
  END as estado_2,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'get_user_cart_shipping_cost'
    ) THEN '✅ get_user_cart_shipping_cost EXISTE'
    ELSE '❌ get_user_cart_shipping_cost NO EXISTE'
  END as estado_3;

-- Ver firma completa de calculate_shipping_cost_cart si existe
SELECT 
  '📝 FIRMA DE calculate_shipping_cost_cart' as info,
  pg_get_functiondef('calculate_shipping_cost_cart'::regproc) as definicion
WHERE EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'calculate_shipping_cost_cart'
);
