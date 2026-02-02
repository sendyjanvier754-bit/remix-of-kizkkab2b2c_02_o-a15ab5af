-- ============================================================================
-- ASIGNAR PRODUCTOS Y SELLERS AL MERCADO HAITI
-- ============================================================================

-- 1. Asignar TODOS los productos activos al mercado Haiti
INSERT INTO public.product_markets (product_id, market_id, is_active)
SELECT 
  p.id as product_id,
  m.id as market_id,
  true as is_active
FROM public.products p
CROSS JOIN public.markets m
WHERE m.code = 'HT'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.product_markets pm 
    WHERE pm.product_id = p.id AND pm.market_id = m.id
  );

-- 2. Asignar TODOS los sellers (perfiles con rol seller) al mercado Haiti
INSERT INTO public.seller_markets (seller_id, market_id, is_primary)
SELECT 
  p.id as seller_id,
  m.id as market_id,
  true as is_primary
FROM public.profiles p
CROSS JOIN public.markets m
WHERE m.code = 'HT'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'seller'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.seller_markets sm 
    WHERE sm.seller_id = p.id AND sm.market_id = m.id
  );

-- 3. Verificar asignaciones
SELECT 
  'Asignaciones completadas' as status,
  (SELECT COUNT(*) FROM public.product_markets WHERE market_id IN (SELECT id FROM markets WHERE code = 'HT')) as productos_asignados,
  (SELECT COUNT(*) FROM public.seller_markets WHERE market_id IN (SELECT id FROM markets WHERE code = 'HT')) as sellers_asignados;

-- 4. Ver resumen del mercado
SELECT * FROM public.markets_dashboard WHERE code = 'HT';
