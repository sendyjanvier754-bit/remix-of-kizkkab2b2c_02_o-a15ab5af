-- =============================================================================
-- TRIGGER MEJORADO: Usar Tarifas Reales de Logística
-- =============================================================================
-- 
-- En lugar de usar la fórmula simplificada ($11.05 + $5.82), este trigger
-- usa las tarifas configuradas en shipping_tiers, route_logistics_costs, etc.
--
-- VENTAJAS:
-- - Usa tarifas configurables desde la base de datos
-- - Considera ruta de envío (China → USA → Haití)
-- - Considera tipo de envío (Standard/Express)
-- - Considera sobrepeso y dimensiones
-- - Permite cambiar tarifas sin modificar código
--
-- =============================================================================

-- Función mejorada que usa tarifas reales
CREATE OR REPLACE FUNCTION fn_update_cart_shipping_cost_dynamic()
RETURNS TRIGGER AS $$
DECLARE
  v_cart_id UUID;
  v_cart_table TEXT;
  v_route_id UUID;
  v_shipping_type_id UUID;
  v_total_weight NUMERIC;
  v_has_oversize BOOLEAN;
  v_max_length NUMERIC;
  v_max_width NUMERIC;
  v_max_height NUMERIC;
  v_shipping_cost NUMERIC;
  v_cost_result JSONB;
BEGIN
  -- Determinar qué carrito actualizar (B2B o B2C)
  IF TG_TABLE_NAME = 'b2b_cart_items' THEN
    v_cart_table := 'b2b_carts';
  ELSE
    v_cart_table := 'b2c_carts';
  END IF;
  
  -- Obtener el cart_id
  IF TG_OP = 'DELETE' THEN
    v_cart_id := OLD.cart_id;
  ELSE
    v_cart_id := NEW.cart_id;
  END IF;
  
  -- Obtener route_id y shipping_type_id del carrito (si existen)
  IF v_cart_table = 'b2b_carts' THEN
    SELECT route_id, shipping_type_id
    INTO v_route_id, v_shipping_type_id
    FROM b2b_carts
    WHERE id = v_cart_id;
  ELSE
    SELECT route_id, shipping_type_id
    INTO v_route_id, v_shipping_type_id
    FROM b2c_carts
    WHERE id = v_cart_id;
  END IF;
  
  -- Si no tiene route_id, usar la ruta por defecto (China → Haití via USA)
  IF v_route_id IS NULL THEN
    SELECT id INTO v_route_id
    FROM shipping_routes
    WHERE origin_hub_id = (SELECT id FROM transportation_hubs WHERE code = 'CN-GZ')
      AND destination_country_id = (SELECT id FROM destination_countries WHERE code = 'HT')
    LIMIT 1;
  END IF;
  
  -- If no route found, fallback to simplified formula
  IF v_route_id IS NULL THEN
    -- Calcular peso total simple
    IF TG_TABLE_NAME = 'b2b_cart_items' THEN
      SELECT COALESCE(SUM(COALESCE(peso_kg, 0) * COALESCE(quantity, 1)), 0)
      INTO v_total_weight
      FROM b2b_cart_items
      WHERE cart_id = v_cart_id;
    ELSE
      SELECT COALESCE(SUM(COALESCE(peso_kg, 0) * COALESCE(quantity, 1)), 0)
      INTO v_total_weight
      FROM b2c_cart_items
      WHERE cart_id = v_cart_id;
    END IF;
    
    -- Usar fórmula simplificada como fallback
    IF v_total_weight = 0 THEN
      v_shipping_cost := 0;
    ELSIF CEIL(v_total_weight) <= 1 THEN
      v_shipping_cost := 11.05;
    ELSE
      v_shipping_cost := 11.05 + ((CEIL(v_total_weight) - 1) * 5.82);
    END IF;
    
  ELSE
    -- Usar función de cálculo real con tarifas de BD
    -- Obtener datos agregados de los items
    IF TG_TABLE_NAME = 'b2b_cart_items' THEN
      SELECT 
        COALESCE(SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1)), 0),
        BOOL_OR(p.is_oversize),
        MAX(p.length_cm),
        MAX(p.width_cm),
        MAX(p.height_cm)
      INTO v_total_weight, v_has_oversize, v_max_length, v_max_width, v_max_height
      FROM b2b_cart_items bci
      LEFT JOIN products p ON bci.product_id = p.id
      WHERE bci.cart_id = v_cart_id;
    ELSE
      SELECT 
        COALESCE(SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1)), 0),
        BOOL_OR(p.is_oversize),
        MAX(p.length_cm),
        MAX(p.width_cm),
        MAX(p.height_cm)
      INTO v_total_weight, v_has_oversize, v_max_length, v_max_width, v_max_height
      FROM b2c_cart_items bci
      LEFT JOIN products p ON bci.product_id = p.id
      WHERE bci.cart_id = v_cart_id;
    END IF;
    
    -- Llamar a la función real de cálculo de shipping
    BEGIN
      SELECT * INTO v_cost_result
      FROM calculate_shipping_cost_cart(
        v_route_id,
        v_total_weight,
        v_shipping_type_id,
        COALESCE(v_has_oversize, FALSE),
        v_max_length,
        v_max_width,
        v_max_height
      );
      
      -- Extraer el costo total de la respuesta
      v_shipping_cost := (v_cost_result->>'total_cost_with_type')::NUMERIC;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si la función falla, usar fórmula simplificada
        RAISE WARNING 'Error calculating shipping cost, using fallback formula: %', SQLERRM;
        IF v_total_weight = 0 THEN
          v_shipping_cost := 0;
        ELSIF CEIL(v_total_weight) <= 1 THEN
          v_shipping_cost := 11.05;
        ELSE
          v_shipping_cost := 11.05 + ((CEIL(v_total_weight) - 1) * 5.82);
        END IF;
    END;
  END IF;
  
  -- Actualizar el carrito con los valores calculados
  IF v_cart_table = 'b2b_carts' THEN
    UPDATE b2b_carts
    SET 
      total_weight_kg = v_total_weight,
      shipping_cost_usd = v_shipping_cost,
      last_shipping_update = NOW()
    WHERE id = v_cart_id;
  ELSE
    UPDATE b2c_carts
    SET 
      total_weight_kg = v_total_weight,
      shipping_cost_usd = v_shipping_cost,
      last_shipping_update = NOW()
    WHERE id = v_cart_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_update_cart_shipping_cost_dynamic() IS 
  'Recalcula el costo de envío usando tarifas reales de la base de datos.
   
   Jerarquía de cálculo:
   1. Intenta usar calculate_shipping_cost_cart() con tarifas reales
   2. Si falla o no hay ruta configurada, usa fórmula simplificada
   
   Considera:
   - route_id del carrito (o ruta por defecto)
   - shipping_type_id (Standard/Express)
   - Peso total de items
   - Sobrepeso (is_oversize)
   - Dimensiones (length/width/height)
   
   Actualiza automáticamente:
   - total_weight_kg
   - shipping_cost_usd
   - last_shipping_update';

-- Reemplazar triggers existentes
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2b_cart_items;
CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost_dynamic();

DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2c_cart_items;
CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost_dynamic();

-- =============================================================================
-- Verificación
-- =============================================================================

SELECT 
  '✅ Triggers actualizados para usar tarifas reales' as status;

-- Ver qué función usa cada trigger
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_cart_shipping';

-- =============================================================================
-- NOTAS IMPORTANTES
-- =============================================================================
/*
CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR:
========================================

ANTES (Fórmula Simplificada):
------------------------------
✗ Usa valores hardcoded: $11.05 base + $5.82 por kg adicional
✗ No considera ruta de envío
✗ No considera tipo de envío (Standard/Express)
✗ No considera sobrepeso ni dimensiones
✗ Para cambiar tarifas hay que modificar código

AHORA (Tarifas Reales):
-----------------------
✓ Usa tarifas configurables desde shipping_tiers
✓ Considera ruta completa (China → USA → Haití)
✓ Considera tipo de envío seleccionado por el usuario
✓ Considera sobrepeso y dimensiones de productos
✓ Para cambiar tarifas solo se actualizan las tablas de configuración
✓ Tiene fallback a fórmula simple si hay error

IMPACTO EN COSTOS:
==================
Los costos pueden ser DIFERENTES porque ahora se usan tarifas reales:

Ejemplo con 1 kg:
- Fórmula simple: $11.05
- Tarifa real: depende de la configuración en shipping_tiers
  (puede ser mayor o menor)

Recomendación: Probar con carritos existentes y comparar resultados.

CONFIGURACIÓN DE TARIFAS:
==========================
Para ajustar las tarifas reales, edita las tablas:
- shipping_tiers: Define tramo_a_cost_per_kg y tramo_b_cost_per_lb
- shipping_types: Define cargos extra (extra_charge)
- shipping_cost_oversize_rules: Define cargos por sobrepeso
- shipping_cost_dimensional_rules: Define cargos dimensionales

Si quieres mantener los valores $11.05 y $5.82, configúralos en estas tablas.
*/

-- =============================================================================
-- Test: Comparar fórmula simple vs tarifas reales
-- =============================================================================
/*
WITH test_weights AS (
  SELECT unnest(ARRAY[0.5, 1.0, 2.0, 3.5, 5.0]) as peso_kg
),
simple_formula AS (
  SELECT 
    peso_kg,
    CASE 
      WHEN peso_kg = 0 THEN 0
      WHEN CEIL(peso_kg) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(peso_kg) - 1) * 5.82)
    END as costo_simple
  FROM test_weights
),
real_tariffs AS (
  SELECT 
    tw.peso_kg,
    (SELECT (result->>'total_cost_with_type')::NUMERIC
     FROM calculate_shipping_cost_cart(
       (SELECT id FROM shipping_routes LIMIT 1),
       tw.peso_kg,
       NULL,
       FALSE,
       NULL, NULL, NULL
     ) as result
    ) as costo_real
  FROM test_weights tw
)
SELECT 
  sf.peso_kg as "Peso (kg)",
  sf.costo_simple as "Fórmula Simple ($)",
  rt.costo_real as "Tarifa Real ($)",
  ROUND((rt.costo_real - sf.costo_simple)::NUMERIC, 2) as "Diferencia ($)",
  ROUND(((rt.costo_real - sf.costo_simple) / sf.costo_simple * 100)::NUMERIC, 1) as "% Diferencia"
FROM simple_formula sf
JOIN real_tariffs rt ON sf.peso_kg = rt.peso_kg
ORDER BY sf.peso_kg;
*/
