-- =============================================================================
-- VERIFICACIÓN DETALLADA: Cálculo de costo de logística
-- Fecha: 2026-02-12
-- Objetivo: Verificar que $8.71 sea correcto según la lógica configurada
-- =============================================================================

-- 1. Ver la configuración de la ruta CHINA → HT
SELECT 
  sr.id as route_id,
  th.name as origen,
  th.code as origen_code,
  dc.name as destino,
  dc.code as destino_code,
  sr.base_rate_per_kg as tarifa_base_por_kg,
  sr.oversize_surcharge_per_kg as recargo_oversize_por_kg,
  sr.dimensional_weight_factor as factor_peso_dimensional,
  sr.is_active
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT'
  AND sr.is_active = TRUE;

-- 2. Verificar producto específico: Camiseta (SKU: 924221472)
SELECT 
  p.id,
  p.nombre,
  p.sku_interno,
  p.peso_kg,
  p.peso_g,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  -- Calcular peso volumétrico si aplica
  CASE 
    WHEN p.length_cm > 0 AND p.width_cm > 0 AND p.height_cm > 0
    THEN (p.length_cm * p.width_cm * p.height_cm) / 1000000.0  -- m³
    ELSE NULL
  END as volumen_m3
FROM products p
WHERE p.sku_interno = '924221472';

-- 3. Ver el cálculo detallado desde la vista
SELECT 
  product_id,
  product_name,
  sku,
  weight_kg as peso_producto_kg,
  is_oversize,
  calculated_weight_kg as peso_calculado_kg,
  base_cost as costo_base,
  oversize_surcharge as recargo_oversize,
  dimensional_surcharge as recargo_dimensional,
  volume_m3 as volumen,
  total_cost as costo_total,
  
  -- Verificación manual del cálculo
  'Cálculo esperado:' as verificacion,
  CONCAT(
    'Base: ', ROUND(base_cost, 2), 
    ' + Oversize: ', ROUND(oversize_surcharge, 2),
    ' + Dimensional: ', ROUND(dimensional_surcharge, 2),
    ' = ', ROUND(base_cost + oversize_surcharge + dimensional_surcharge, 2)
  ) as formula
FROM v_product_shipping_costs
WHERE sku = '924221472';

-- 4. Simular el cálculo paso a paso
WITH producto AS (
  SELECT 
    id,
    nombre,
    sku_interno,
    COALESCE(peso_kg, peso_g / 1000.0, 0) as peso_kg,
    is_oversize,
    length_cm,
    width_cm,
    height_cm
  FROM products
  WHERE sku_interno = '924221472'
),
ruta AS (
  SELECT 
    sr.id,
    sr.base_rate_per_kg,
    sr.oversize_surcharge_per_kg,
    sr.dimensional_weight_factor
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' 
    AND dc.code = 'HT'
    AND sr.is_active = TRUE
  LIMIT 1
)
SELECT 
  p.nombre,
  p.sku_interno,
  p.peso_kg as peso_original,
  
  -- Paso 1: Peso a usar (redondeado hacia arriba)
  CEIL(p.peso_kg) as peso_redondeado,
  
  -- Paso 2: Costo base = peso * tarifa_base
  r.base_rate_per_kg as tarifa_base,
  CEIL(p.peso_kg) * r.base_rate_per_kg as costo_base_calculado,
  
  -- Paso 3: Recargo oversize (si aplica)
  p.is_oversize as es_oversize,
  CASE 
    WHEN p.is_oversize THEN CEIL(p.peso_kg) * r.oversize_surcharge_per_kg
    ELSE 0
  END as recargo_oversize_calculado,
  
  -- Paso 4: Volumen (si aplica)
  CASE 
    WHEN p.length_cm > 0 AND p.width_cm > 0 AND p.height_cm > 0
    THEN (p.length_cm * p.width_cm * p.height_cm) / 1000000.0
    ELSE NULL
  END as volumen_m3,
  
  -- Paso 5: Peso dimensional (si aplica)
  CASE 
    WHEN p.length_cm > 0 AND p.width_cm > 0 AND p.height_cm > 0
    THEN ((p.length_cm * p.width_cm * p.height_cm) / 1000000.0) * r.dimensional_weight_factor
    ELSE NULL
  END as peso_dimensional_kg,
  
  -- Paso 6: Recargo dimensional
  CASE 
    WHEN p.length_cm > 0 AND p.width_cm > 0 AND p.height_cm > 0
      AND ((p.length_cm * p.width_cm * p.height_cm) / 1000000.0) * r.dimensional_weight_factor > p.peso_kg
    THEN (((p.length_cm * p.width_cm * p.height_cm) / 1000000.0) * r.dimensional_weight_factor - p.peso_kg) * r.base_rate_per_kg
    ELSE 0
  END as recargo_dimensional_calculado,
  
  -- Paso 7: TOTAL
  (CEIL(p.peso_kg) * r.base_rate_per_kg) +
  CASE WHEN p.is_oversize THEN CEIL(p.peso_kg) * r.oversize_surcharge_per_kg ELSE 0 END +
  CASE 
    WHEN p.length_cm > 0 AND p.width_cm > 0 AND p.height_cm > 0
      AND ((p.length_cm * p.width_cm * p.height_cm) / 1000000.0) * r.dimensional_weight_factor > p.peso_kg
    THEN (((p.length_cm * p.width_cm * p.height_cm) / 1000000.0) * r.dimensional_weight_factor - p.peso_kg) * r.base_rate_per_kg
    ELSE 0
  END as total_calculado_manual,
  
  '---COMPARAR CON---' as separador,
  
  -- Valor de la vista
  (SELECT total_cost FROM v_product_shipping_costs WHERE sku = '924221472') as total_en_vista
  
FROM producto p, ruta r;

-- 5. Verificar otros productos también
SELECT 
  sku,
  product_name,
  weight_kg,
  is_oversize,
  base_cost,
  oversize_surcharge,
  dimensional_surcharge,
  total_cost,
  CASE 
    WHEN ABS((base_cost + oversize_surcharge + dimensional_surcharge) - total_cost) < 0.01 
    THEN 'Cálculo correcto'
    ELSE 'Verificar cálculo'
  END as validacion
FROM v_product_shipping_costs
WHERE sku IN ('924221472', '2962434831', '758788899')
ORDER BY sku;

-- =============================================================================
-- INTERPRETACIÓN:
-- Si el cálculo manual coincide con total_en_vista = $8.71, entonces es correcto
-- Revisar:
-- - base_rate_per_kg: ¿Cuánto cuesta por kg?
-- - peso_redondeado: 0.6 kg se redondea a 1 kg
-- - is_oversize: ¿Tiene recargo adicional?
-- - Dimensiones: ¿Aplica peso volumétrico?
-- =============================================================================
