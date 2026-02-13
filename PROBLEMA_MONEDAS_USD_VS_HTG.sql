-- =============================================================================
-- PROBLEMA: Monedas mezcladas USD vs HTG
-- Fecha: 2026-02-12
-- =============================================================================

/*
PROBLEMA DETECTADO:
===================
- Los precios de productos (precio_b2b, precio_b2c) están en USD ($)
- Los costos de logística están en HTG (Gourde Haitiano)
- Esto causa inconsistencia en los cálculos

EJEMPLO DEL PROBLEMA:
=====================
Producto:
  precio_b2b = $10 USD
  costo_logistica = 29.05 HTG
  
PVP calculado: $10 USD + 29.05 HTG = ??? (monedas diferentes)


SOLUCIÓN REQUERIDA:
===================
Opción 1: Convertir costos de logística a USD
Opción 2: Convertir precios de productos a HTG
Opción 3: Agregar conversión automática en el sistema

RECOMENDACIÓN: Opción 1 (mantener todo en USD)
*/

-- =============================================================================
-- VERIFICAR: Moneda actual de los costos de logística
-- =============================================================================

-- 1. Ver tarifas actuales en route_logistics_costs
SELECT 
  'Tarifas de logística' as info,
  segment as tramo,
  cost_per_kg as costo_por_kg,
  'HTG o USD?' as moneda_actual
FROM route_logistics_costs rlc
JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT'
  AND sr.is_active = TRUE;

-- 2. Ver ejemplo de precio de producto (debería estar en USD)
SELECT 
  'Precios de productos' as info,
  p.nombre,
  p.precio_sugerido_venta as precio_venta_usd,
  'USD' as moneda_esperada
FROM products p
WHERE p.precio_sugerido_venta > 0
  AND p.is_active = TRUE
LIMIT 5;

-- 3. Calcular costo logística para 2 kg
WITH route_data AS (
  SELECT sr.id as route_id
  FROM shipping_routes sr
  JOIN transit_hubs th ON sr.transit_hub_id = th.id
  JOIN destination_countries dc ON sr.destination_country_id = dc.id
  WHERE th.code = 'CHINA' AND dc.code = 'HT' AND sr.is_active = TRUE
  LIMIT 1
)
SELECT 
  '⚠️ PROBLEMA: Monedas mezcladas' as alerta,
  2.0 as peso_kg,
  base_cost as costo_logistica,
  'HTG o USD?' as moneda_logistica,
  'Debe ser USD para consistencia' as solucion_requerida
FROM calculate_shipping_cost_cart(
  (SELECT route_id FROM route_data),
  2.0,
  (SELECT id FROM shipping_type_configs WHERE type = 'STANDARD' AND is_active = TRUE LIMIT 1),
  FALSE,
  NULL,
  NULL,
  NULL
);

-- =============================================================================
-- TASA DE CAMBIO: HTG a USD (para referencia)
-- =============================================================================

/*
Tasa aproximada (febrero 2026):
1 USD ≈ 135-145 HTG

Si los costos están en HTG, necesitas dividir por la tasa de cambio:
29.05 HTG ÷ 140 = $0.21 USD (aproximado)
*/

SELECT 
  '💱 Conversión HTG → USD' as info,
  29.05 as costo_htg,
  140 as tasa_cambio_aprox,
  ROUND((29.05 / 140.0)::numeric, 2) as costo_usd_equivalente,
  'Tasa puede variar - verificar tasa actual' as nota;

-- =============================================================================
-- ACCIÓN REQUERIDA:
-- =============================================================================

/*
1. VERIFICAR qué moneda están en route_logistics_costs:
   - Si cost_per_kg = 3.50 → probablemente USD
   - Si cost_per_kg = 500 → probablemente HTG

2. Si está en HTG, ACTUALIZAR a USD:
   UPDATE route_logistics_costs
   SET cost_per_kg = cost_per_kg / 140.0  -- Ajustar según tasa actual
   WHERE shipping_route_id IN (
     SELECT sr.id FROM shipping_routes sr
     JOIN transit_hubs th ON sr.transit_hub_id = th.id
     WHERE th.code = 'CHINA'
   );

3. AGREGAR columna currency (opcional):
   ALTER TABLE route_logistics_costs 
   ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';

4. ACTUALIZAR funciones para incluir conversión automática si es necesario
*/
