-- Verificar que la vista existe y funciona
SELECT 
  '🔍 VERIFICAR VISTA' as info,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'v_cart_shipping_costs';

-- Ver definición de la vista
SELECT 
  '📝 DEFINICIÓN' as info,
  pg_get_viewdef('v_cart_shipping_costs', true) as definition;

-- Intentar consultar la vista SIN auth.uid() (simulando)
-- Esto fallará si la vista requiere auth.uid()
SELECT 
  '⚠️ INTENTAR CONSULTA DIRECTA' as info,
  * 
FROM v_cart_shipping_costs
LIMIT 5;
