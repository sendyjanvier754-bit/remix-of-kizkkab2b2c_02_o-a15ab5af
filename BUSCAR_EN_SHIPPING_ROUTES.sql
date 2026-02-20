-- =============================================================================
-- HIPÓTESIS: destination_country_id está en shipping_routes, NO en route_logistics_costs
-- =============================================================================

-- ============= Verificar: ¿shipping_routes tiene destination_country_id? =============

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shipping_routes'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============= Si existe: Ver datos de shipping_routes =============

SELECT * FROM shipping_routes LIMIT 10;

-- ============= Relación: shipping_routes → destination_countries =============

SELECT 
  sr.id as route_id,
  sr.destination_country_id,
  dc.name as pais,
  dc.code
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LIMIT 20;

-- ============= Relación: user → shipping_address → destination_country_id =============

SELECT 
  u.id as user_id,
  u.email,
  sa.destination_country_id,
  dc.name as pais
FROM auth.users u
LEFT JOIN shipping_addresses sa ON u.id = sa.user_id
LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
WHERE sa.destination_country_id IS NOT NULL
LIMIT 20;

-- ============= Relación: shipping_routes x destination_country → shipping_tiers =============

SELECT 
  sr.id as route_id,
  dc.name as pais,
  st.id as tier_id,
  st.tier_name,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb
FROM shipping_routes sr
LEFT JOIN destination_countries dc ON sr.destination_country_id = dc.id
LEFT JOIN shipping_tiers st ON sr.id = st.route_id
WHERE st.is_active = TRUE
LIMIT 30;

-- ============= TEST: Obtener país usuario y productos con peso =============

WITH user_country AS (
  SELECT DISTINCT sa.destination_country_id
  FROM shipping_addresses sa
  WHERE sa.destination_country_id IS NOT NULL
  LIMIT 1
),
products_weight AS (
  SELECT DISTINCT p.id, SUM(bci.peso_kg * bci.quantity) as total_weight
  FROM products p
  JOIN b2b_cart_items bci ON p.id = bci.product_id
  WHERE bci.peso_kg > 0
  GROUP BY p.id
  LIMIT 1
)
SELECT 
  uc.destination_country_id as country_id,
  pw.id as product_id,
  pw.total_weight
FROM user_country uc, products_weight pw;
