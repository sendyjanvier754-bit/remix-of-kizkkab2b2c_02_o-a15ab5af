-- =============================================================================
-- EXPLICACIÓN: Cómo funciona v_cart_shipping_costs
-- Fecha: 2026-02-12
-- =============================================================================

/*
RESUMEN:
--------
La vista v_cart_shipping_costs simula un carrito de compras con 10 productos 
activos y calcula los costos de envío usando la función calculate_shipping_cost_cart().

FLUJO DE DATOS:
---------------

PASO 1: route_config - Obtener ruta de envío CHINA → HT
   ↓
   - Busca shipping_routes activa con origen CHINA y destino HT
   - Si no existe, usa ruta por defecto: '21420dcb-9d8a-4947-8530-aaf3519c9047'

PASO 2: cart_items - Simular carrito con 10 productos
   ↓
   - Selecciona 10 productos activos (ordenados por nombre)
   - Extrae: weight_kg, is_oversize, dimensiones (length, width, height)
   - Asigna quantity = 1 a cada producto

PASO 3: cart_totals - Calcular totales del carrito
   ↓
   - total_items: COUNT(*)
   - total_weight_kg: SUM(weight_kg × quantity)
   - weight_rounded_kg: CEIL(total_weight_kg) -- Redondea hacia arriba
   - has_oversize: BOOL_OR(is_oversize) -- TRUE si al menos 1 es oversize
   - max_length_cm, max_width_cm, max_height_cm: Dimensiones máximas

PASO 4: Llamar función calculate_shipping_cost_cart()
   ↓
   - Parámetros:
     * route_id: Ruta CHINA → HT
     * total_weight_kg: Peso total del carrito
     * shipping_type_id: Tipo STANDARD
     * has_oversize: ¿Tiene productos oversize?
     * max_length_cm, max_width_cm, max_height_cm: Dimensiones máximas
   
   - Retorna 15 campos:
     1. weight_rounded_kg: Peso redondeado calculado
     2. base_cost: Costo base por peso
     3. oversize_surcharge: Cargo por oversize
     4. dimensional_surcharge: Cargo por dimensiones
     5. volume_m3: Volumen en metros cúbicos
     6. extra_cost: Costos adicionales
     7. shipping_type_name: Nombre del tipo de envío
     8. shipping_type_display: Nombre para mostrar
     9. total_cost_with_type: COSTO TOTAL FINAL
     10-15. Otros campos de metadata

PASO 5: SELECT FINAL - Combinar todos los datos
   ↓
   - total_items (del carrito)
   - total_weight_kg (calculado)
   - Todos los campos de calculate_shipping_cost_cart()
   - last_updated: NOW()


TABLAS INVOLUCRADAS:
--------------------
1. products → Productos activos del catálogo
2. shipping_routes → Ruta de envío (CHINA → HT)
3. transit_hubs → Hub de origen (CHINA)
4. destination_countries → País destino (HT)
5. shipping_type_configs → Tipo de envío (STANDARD)

FUNCIÓN UTILIZADA:
------------------
calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,
  p_has_oversize BOOLEAN,
  p_max_length_cm NUMERIC,
  p_max_width_cm NUMERIC,
  p_max_height_cm NUMERIC
) RETURNS TABLE (15 campos)

RESULTADO FINAL:
----------------
La vista retorna 1 FILA con 15 columnas:
- Datos del carrito simulado (10 productos)
- Costos de envío calculados
- Tipo de envío (STANDARD)
- Costo total con surcharges

*/

-- =============================================================================
-- CONSULTA PARA VER EL FLUJO PASO A PASO
-- =============================================================================

-- PASO 1: Ver ruta configurada
SELECT 
  'PASO 1: Ruta' as paso,
  sr.id as route_id,
  th.code as origen,
  dc.code as destino,
  sr.is_active as activa
FROM shipping_routes sr
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' AND dc.code = 'HT' AND sr.is_active = TRUE
LIMIT 1;

-- PASO 2: Ver productos del carrito simulado
SELECT 
  'PASO 2: Carrito' as paso,
  p.id,
  p.nombre,
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  CONCAT(p.length_cm, 'x', p.width_cm, 'x', p.height_cm) as dimensiones
FROM products p
WHERE p.is_active = TRUE
ORDER BY p.nombre
LIMIT 10;

-- PASO 3: Ver totales calculados
WITH cart_items AS (
  SELECT 
    COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
    p.is_oversize,
    p.length_cm,
    p.width_cm,
    p.height_cm,
    1 as quantity
  FROM products p
  WHERE p.is_active = TRUE
  ORDER BY p.nombre
  LIMIT 10
)
SELECT 
  'PASO 3: Totales' as paso,
  COUNT(*) as total_items,
  SUM(weight_kg * quantity) as total_weight_kg,
  CEIL(SUM(weight_kg * quantity)) as weight_rounded_kg,
  BOOL_OR(is_oversize) as has_oversize,
  MAX(length_cm) as max_length_cm,
  MAX(width_cm) as max_width_cm,
  MAX(height_cm) as max_height_cm
FROM cart_items;

-- PASO 4 & 5: Ver resultado final de la vista
SELECT 
  'PASO 4 & 5: Resultado Final' as paso,
  total_items,
  ROUND(total_weight_kg::numeric, 2) as peso_kg,
  base_cost as costo_base_htg,
  oversize_surcharge as cargo_oversize_htg,
  dimensional_surcharge as cargo_dimensional_htg,
  extra_cost as costo_extra_htg,
  total_cost_with_type as costo_total_htg,
  shipping_type_name as tipo_envio
FROM v_cart_shipping_costs;

-- =============================================================================
-- RESUMEN: Origen de cada campo
-- =============================================================================

/*
CAMPO                          | ORIGEN
-------------------------------|--------------------------------------------------
total_items                    | COUNT(*) de cart_items
total_weight_kg                | SUM(weight_kg × quantity) de cart_items
weight_rounded_kg              | CEIL(total_weight_kg) - Redondeo hacia arriba
route_id                       | shipping_routes (CHINA → HT)
shipping_type_id               | shipping_type_configs (STANDARD)
calculated_weight_rounded_kg   | calculate_shipping_cost_cart() ← función
base_cost                      | calculate_shipping_cost_cart() ← función
oversize_surcharge             | calculate_shipping_cost_cart() ← función
dimensional_surcharge          | calculate_shipping_cost_cart() ← función
volume_m3                      | calculate_shipping_cost_cart() ← función
extra_cost                     | calculate_shipping_cost_cart() ← función
shipping_type_name             | calculate_shipping_cost_cart() ← función
shipping_type_display          | calculate_shipping_cost_cart() ← función
total_cost_with_type           | calculate_shipping_cost_cart() ← función (TOTAL)
last_updated                   | NOW() - Timestamp actual

FUNCIÓN CLAVE: calculate_shipping_cost_cart()
----------------------------------------------
Esta función recibe los parámetros del carrito y retorna todos los costos
calculados según las tarifas configuradas en:
- shipping_cost_matrix (costo base por peso)
- shipping_cost_oversize_rules (cargos por oversize)
- shipping_cost_dimensional_rules (cargos dimensionales)
- shipping_type_configs (multiplicador del tipo de envío)

RESULTADO: total_cost_with_type = base_cost + surcharges + extra_cost
*/
