-- ============================================================================
-- VERIFICAR COLUMNAS EN orders_b2b
-- ============================================================================
-- Esta consulta verifica si las columnas de shipping existen en orders_b2b

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders_b2b'
  AND column_name IN (
    'shipping_tier_id',
    'shipping_cost_global_usd',
    'shipping_cost_local_usd', 
    'shipping_cost_total_usd',
    'local_commune_id',
    'local_pickup_point_id'
  )
ORDER BY ordinal_position;

-- ============================================================================
-- ESPERAMOS VER 6 COLUMNAS:
-- 1. shipping_tier_id
-- 2. shipping_cost_global_usd
-- 3. shipping_cost_local_usd
-- 4. shipping_cost_total_usd
-- 5. local_commune_id
-- 6. local_pickup_point_id
-- ============================================================================
