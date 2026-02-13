-- =============================================================================
-- TRIGGER: Actualizar costo de envío total del carrito automáticamente
-- =============================================================================
-- 
-- OPTIMIZACIÓN OPCIONAL:
-- ----------------------
-- Guardamos el peso total y costo de envío directamente en la tabla b2b_carts
-- para evitar recalcular cada vez desde los items.
--
-- BENEFICIOS:
-- -----------
-- ✅ Frontend lee un solo registro (b2b_carts) en lugar de sumar todos los items
-- ✅ Costo de envío siempre actualizado en tiempo real
-- ✅ Mejor performance en carritos con muchos items
-- ✅ Se actualiza automáticamente al agregar/eliminar/modificar items
--
-- =============================================================================

-- =============================================================================
-- PASO 1: Agregar columnas al carrito
-- =============================================================================

ALTER TABLE b2b_carts
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shipping_update TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN b2b_carts.total_weight_kg IS 
  'Peso total del carrito en kg (suma de peso_kg × quantity de todos los items)';

COMMENT ON COLUMN b2b_carts.shipping_cost_usd IS 
  'Costo de envío calculado en USD según fórmula: 
   - Primer kg: $11.05
   - Cada kg adicional: $5.82';

COMMENT ON COLUMN b2b_carts.last_shipping_update IS 
  'Timestamp de última actualización del costo de envío (se actualiza automáticamente con triggers)';

-- Hacer lo mismo para B2C
ALTER TABLE b2c_carts
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shipping_update TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN b2c_carts.total_weight_kg IS 
  'Peso total del carrito en kg (suma de peso_kg × quantity de todos los items)';

COMMENT ON COLUMN b2c_carts.shipping_cost_usd IS 
  'Costo de envío calculado en USD';

COMMENT ON COLUMN b2c_carts.last_shipping_update IS 
  'Timestamp de última actualización del costo de envío';

-- =============================================================================
-- PASO 2: Función para recalcular el costo de envío del carrito
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_update_cart_shipping_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cart_id UUID;
  v_total_weight NUMERIC;
  v_shipping_cost NUMERIC;
  v_cart_table TEXT;
BEGIN
  -- Determinar qué carrito actualizar (B2B o B2C)
  IF TG_TABLE_NAME = 'b2b_cart_items' THEN
    v_cart_table := 'b2b_carts';
  ELSE
    v_cart_table := 'b2c_carts';
  END IF;
  
  -- Obtener el cart_id del item insertado/actualizado/eliminado
  IF TG_OP = 'DELETE' THEN
    v_cart_id := OLD.cart_id;
  ELSE
    v_cart_id := NEW.cart_id;
  END IF;
  
  -- Calcular peso total del carrito
  -- Suma: peso_kg × quantity de cada item
  IF TG_TABLE_NAME = 'b2b_cart_items' THEN
    SELECT 
      COALESCE(SUM(COALESCE(peso_kg, 0) * COALESCE(quantity, 1)), 0)
    INTO v_total_weight
    FROM b2b_cart_items
    WHERE cart_id = v_cart_id;
  ELSE
    SELECT 
      COALESCE(SUM(COALESCE(peso_kg, 0) * COALESCE(quantity, 1)), 0)
    INTO v_total_weight
    FROM b2c_cart_items
    WHERE cart_id = v_cart_id;
  END IF;
  
  -- Calcular costo de envío según fórmula
  -- Base: Primer kg = $11.05
  -- Extra: Cada kg adicional = $5.82
  IF v_total_weight = 0 THEN
    v_shipping_cost := 0;
  ELSIF CEIL(v_total_weight) <= 1 THEN
    v_shipping_cost := 11.05;
  ELSE
    v_shipping_cost := 11.05 + ((CEIL(v_total_weight) - 1) * 5.82);
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

COMMENT ON FUNCTION fn_update_cart_shipping_cost() IS 
  'Recalcula automáticamente el peso total y costo de envío del carrito
   cuando se agrega, actualiza o elimina un item.
   
   Fórmula de costo:
   - Si peso = 0: $0.00
   - Si peso ≤ 1kg: $11.05
   - Si peso > 1kg: $11.05 + ($5.82 × (kg_redondeados - 1))
   
   Se actualiza automáticamente en b2b_carts y b2c_carts.';

-- =============================================================================
-- PASO 3: Crear triggers para INSERT/UPDATE/DELETE de items
-- =============================================================================

-- Trigger para B2B cart items
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2b_cart_items;

CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost();

COMMENT ON TRIGGER trigger_update_cart_shipping ON b2b_cart_items IS 
  'Actualiza automáticamente el costo de envío en b2b_carts cuando cambian los items';

-- Trigger para B2C cart items
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2c_cart_items;

CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost();

COMMENT ON TRIGGER trigger_update_cart_shipping ON b2c_cart_items IS 
  'Actualiza automáticamente el costo de envío en b2c_carts cuando cambian los items';

-- =============================================================================
-- PASO 4: Actualizar carritos existentes (una sola vez)
-- =============================================================================

-- Recalcular peso y costo para todos los carritos B2B abiertos
UPDATE b2b_carts bc
SET 
  total_weight_kg = (
    SELECT COALESCE(SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1)), 0)
    FROM b2b_cart_items bci
    WHERE bci.cart_id = bc.id
  ),
  shipping_cost_usd = (
    CASE 
      WHEN COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2b_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      ) = 0 THEN 0
      WHEN CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2b_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      )) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2b_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      )) - 1) * 5.82)
    END
  ),
  last_shipping_update = NOW()
WHERE bc.status = 'open';

-- Recalcular peso y costo para todos los carritos B2C abiertos
UPDATE b2c_carts bc
SET 
  total_weight_kg = (
    SELECT COALESCE(SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1)), 0)
    FROM b2c_cart_items bci
    WHERE bci.cart_id = bc.id
  ),
  shipping_cost_usd = (
    CASE 
      WHEN COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2c_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      ) = 0 THEN 0
      WHEN CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2c_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      )) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2c_cart_items bci
         WHERE bci.cart_id = bc.id),
        0
      )) - 1) * 5.82)
    END
  ),
  last_shipping_update = NOW()
WHERE bc.status = 'open';

-- =============================================================================
-- PASO 5: Verificación
-- =============================================================================

-- Verificar triggers instalados
SELECT 
  '✅ TRIGGERS DE COSTO DE ENVÍO INSTALADOS' as status,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_cart_shipping'
ORDER BY event_object_table;

-- Verificar carritos B2B actualizados
SELECT 
  '🛒 CARRITOS B2B CON COSTO CALCULADO' as info,
  bc.id,
  COUNT(bci.id) as total_items,
  bc.total_weight_kg as "Peso Total (kg)",
  bc.shipping_cost_usd as "Costo Envío (USD)",
  bc.last_shipping_update as "Última Actualización"
FROM b2b_carts bc
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.total_weight_kg, bc.shipping_cost_usd, bc.last_shipping_update
ORDER BY bc.created_at DESC
LIMIT 10;

-- Verificar carritos B2C actualizados
SELECT 
  '🛒 CARRITOS B2C CON COSTO CALCULADO' as info,
  bc.id,
  COUNT(bci.id) as total_items,
  bc.total_weight_kg as "Peso Total (kg)",
  bc.shipping_cost_usd as "Costo Envío (USD)",
  bc.last_shipping_update as "Última Actualización"
FROM b2c_carts bc
LEFT JOIN b2c_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.total_weight_kg, bc.shipping_cost_usd, bc.last_shipping_update
ORDER BY bc.created_at DESC
LIMIT 10;

-- =============================================================================
-- TEST: Probar el trigger completo
-- =============================================================================
/*
-- Test 1: Agregar item y verificar que el carrito se actualiza
INSERT INTO b2b_cart_items (cart_id, product_id, sku, nombre, quantity, unit_price, total_price)
VALUES (
  (SELECT id FROM b2b_carts WHERE status = 'open' LIMIT 1),
  (SELECT id FROM products WHERE is_active = TRUE LIMIT 1),
  'TEST-SHIPPING-TRIGGER',
  'Test Shipping Trigger',
  2,
  10.00,
  20.00
);

-- Ver que el carrito se actualizó automáticamente
SELECT 
  bc.id,
  bc.total_weight_kg,
  bc.shipping_cost_usd,
  bc.last_shipping_update
FROM b2b_carts bc
WHERE bc.id = (SELECT cart_id FROM b2b_cart_items WHERE sku = 'TEST-SHIPPING-TRIGGER');

-- Limpiar test
DELETE FROM b2b_cart_items WHERE sku = 'TEST-SHIPPING-TRIGGER';
*/

-- =============================================================================
-- USO EN FRONTEND
-- =============================================================================
/*
ANTES (leer desde vista):
-------------------------
SELECT * FROM v_cart_shipping_costs;
→ Calcula en tiempo real (más lento con muchos items)

AHORA (leer desde tabla):
-------------------------
SELECT 
  id,
  total_weight_kg,
  shipping_cost_usd,
  last_shipping_update
FROM b2b_carts
WHERE buyer_user_id = auth.uid() 
  AND status = 'open';
→ Lectura directa (mucho más rápido)

TypeScript:
-----------
const { data: cart } = await supabase
  .from('b2b_carts')
  .select('id, total_weight_kg, shipping_cost_usd')
  .eq('buyer_user_id', user.id)
  .eq('status', 'open')
  .single();

console.log('Peso total:', cart.total_weight_kg, 'kg');
console.log('Costo envío:', cart.shipping_cost_usd, 'USD');
*/

-- =============================================================================
-- SIGUIENTE PASO
-- =============================================================================
/*
✅ TRIGGERS DE COSTO DE ENVÍO INSTALADOS

BENEFICIOS:
-----------
✅ Peso total y costo de envío guardados en b2b_carts/b2c_carts
✅ Se actualiza automáticamente al agregar/modificar/eliminar items
✅ Frontend lee directamente desde la tabla (sin calcular en tiempo real)
✅ Mejor performance con carritos grandes

FRONTEND:
---------
Puedes leer el costo directamente desde:
- b2b_carts.shipping_cost_usd
- b2b_carts.total_weight_kg

En lugar de calcular desde v_cart_shipping_costs
*/
