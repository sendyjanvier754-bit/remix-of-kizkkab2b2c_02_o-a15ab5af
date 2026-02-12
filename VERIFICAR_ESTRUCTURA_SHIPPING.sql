-- =============================================================================
-- VERIFICAR ESTRUCTURA Y CALCULAR LOGÍSTICA
-- Fecha: 2026-02-12
-- =============================================================================

-- Paso 1: Ver columnas de shipping_routes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipping_routes'
ORDER BY ordinal_position;

-- Paso 2: Ver datos de la ruta CHINA -> HT
SELECT *
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT'
  AND sr.is_active = TRUE;

-- Paso 3: Ver producto Camiseta
SELECT 
  id,
  nombre,
  sku_interno,
  peso_kg,
  peso_g,
  is_oversize,
  length_cm,
  width_cm,
  height_cm
FROM products
WHERE sku_interno = '924221472';

-- Paso 4: Ver resultado desde la vista
SELECT 
  product_name,
  sku,
  weight_kg as peso_usado,
  calculated_weight_kg as peso_calculado,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  total_cost,
  'Formula: base_cost + oversize + dimensional = total' as verificacion,
  ROUND(base_cost + oversize_surcharge + dimensional_surcharge, 2) as suma_componentes
FROM v_product_shipping_costs
WHERE sku = '924221472';

-- Paso 5: ¿El total coincide con la suma de componentes?
SELECT 
  sku,
  total_cost,
  base_cost + oversize_surcharge + dimensional_surcharge as suma_manual,
  CASE 
    WHEN ABS(total_cost - (base_cost + oversize_surcharge + dimensional_surcharge)) < 0.01
    THEN 'Calculo correcto'
    ELSE 'Revisar'
  END as estado
FROM v_product_shipping_costs
WHERE sku IN ('924221472', '2962434831', '758788899');
