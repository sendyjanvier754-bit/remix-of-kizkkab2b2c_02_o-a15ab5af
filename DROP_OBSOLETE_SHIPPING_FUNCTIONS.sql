-- ============================================================================
-- ELIMINAR FUNCIONES OBSOLETAS DE CÁLCULO DE ENVÍO
-- ============================================================================
-- 
-- Este script elimina funciones antiguas que ya no se usan o que usan
-- lógica/tablas deprecadas (shipping_type_configs, etc.)
-- 
-- FUNCIONES MODERNAS (NO SE ELIMINAN):
-- ✅ calculate_shipping_cost_cart(peso, tier_id, ...)
-- ✅ calculate_shipping_cost_for_selected_items(item_ids[], tier_id)
-- 
-- ============================================================================

-- ============================================================================
-- 1. Eliminar calculate_cart_shipping_cost_dynamic
-- ============================================================================
-- Versión antigua que posiblemente usa shipping_type_configs

DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cart_shipping_cost_dynamic(UUID, UUID) CASCADE;

-- ============================================================================
-- 2. Eliminar get_cart_shipping_cost
-- ============================================================================
-- Versión antigua similar a get_user_cart_shipping_cost

DROP FUNCTION IF EXISTS public.get_cart_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_shipping_cost(UUID, UUID) CASCADE;

-- ============================================================================
-- 3. Eliminar calculate_shipping_cost (genérica)
-- ============================================================================
-- Función genérica antigua que no usa shipping_tiers

DROP FUNCTION IF EXISTS public.calculate_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(NUMERIC, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(UUID, NUMERIC, UUID) CASCADE;

-- ============================================================================
-- 4. Eliminar calculate_shipping_cost_with_type
-- ============================================================================
-- Versión antigua que probablemente usa shipping_type_configs

DROP FUNCTION IF EXISTS public.calculate_shipping_cost_with_type CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_with_type(UUID, NUMERIC, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost_with_type(NUMERIC, UUID, UUID) CASCADE;

-- ============================================================================
-- 5. Eliminar fn_calculate_shipping_cost (función helper interna)
-- ============================================================================
-- Prefijo fn_ indica función interna, posiblemente obsoleta

DROP FUNCTION IF EXISTS public.fn_calculate_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.fn_calculate_shipping_cost(NUMERIC, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.fn_calculate_shipping_cost(UUID, NUMERIC) CASCADE;

-- ============================================================================
-- 6. Eliminar fn_update_cart_shipping_cost (trigger function obsoleta)
-- ============================================================================
-- Función de trigger antigua que puede calcular costos automáticamente

DROP FUNCTION IF EXISTS public.fn_update_cart_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_cart_shipping_cost() CASCADE;

-- ============================================================================
-- 7. Eliminar fn_update_cart_shipping_cost_dynamic
-- ============================================================================
-- Versión dinámica de trigger obsoleta

DROP FUNCTION IF EXISTS public.fn_update_cart_shipping_cost_dynamic CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_cart_shipping_cost_dynamic() CASCADE;

-- ============================================================================
-- 8. Eliminar fn_calculate_cart_item_weight
-- ============================================================================
-- Función helper antigua para calcular peso (ahora se usa peso_kg directo)

DROP FUNCTION IF EXISTS public.fn_calculate_cart_item_weight CASCADE;
DROP FUNCTION IF EXISTS public.fn_calculate_cart_item_weight() CASCADE;

-- ============================================================================
-- 9. Eliminar get_cart_id_shipping_cost
-- ============================================================================
-- Variante de get_cart_shipping_cost

DROP FUNCTION IF EXISTS public.get_cart_id_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_id_shipping_cost(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_cart_id_shipping_cost(UUID, UUID) CASCADE;

-- ============================================================================
-- 10. Eliminar get_user_cart_shipping_cost
-- ============================================================================
-- Se reemplaza por calculate_shipping_cost_for_selected_items (más flexible)

DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost CASCADE;
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_cart_shipping_cost(UUID, UUID) CASCADE;

-- ============================================================================
-- VERIFICACIÓN: Listar funciones restantes de shipping
-- ============================================================================

SELECT 
  '✅ FUNCIONES OBSOLETAS ELIMINADAS' as status,
  'Verificando funciones restantes...' as nota;

-- Ver qué funciones de shipping quedan
SELECT 
  p.proname as funcion,
  pg_get_function_arguments(p.oid) as parametros,
  CASE 
    WHEN p.proname IN (
      'calculate_shipping_cost_cart',
      'calculate_shipping_cost_for_selected_items'
    ) THEN '✅ MODERNA (mantener)'
    ELSE '⚠️ REVISAR'
  END as estado
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%shipping%cost%' 
    OR p.proname LIKE '%calculate%ship%'
    OR p.proname LIKE '%cart%cost%'
  )
ORDER BY 
  CASE 
    WHEN p.proname IN (
      'calculate_shipping_cost_cart',
      'calculate_shipping_cost_for_selected_items'
    ) THEN 1
    ELSE 2
  END,
  p.proname;

-- ============================================================================
-- RESUMEN
-- ============================================================================

SELECT 
  '🗑️ FUNCIONES ELIMINADAS:' as resumen,
  E'
  1. calculate_cart_shipping_cost_dynamic
  2. get_cart_shipping_cost
  3. calculate_shipping_cost
  4. calculate_shipping_cost_with_type
  5. fn_calculate_shipping_cost
  6. fn_update_cart_shipping_cost
  7. fn_update_cart_shipping_cost_dynamic
  8. fn_calculate_cart_item_weight
  9. get_cart_id_shipping_cost
  10. get_user_cart_shipping_cost ← Reemplazada por calculate_shipping_cost_for_selected_items
  
  ✅ FUNCIONES MODERNAS (mantenidas):
  • calculate_shipping_cost_cart (motor de cálculo)
  • calculate_shipping_cost_for_selected_items (orquestador - usa el motor)
  ' as detalle;
