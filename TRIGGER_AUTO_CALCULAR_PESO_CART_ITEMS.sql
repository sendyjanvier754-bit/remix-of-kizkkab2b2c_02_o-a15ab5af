-- =============================================================================
-- TRIGGER: Calcular peso automáticamente al insertar/actualizar items del carrito
-- =============================================================================
-- 
-- PROBLEMA QUE RESUELVE:
-- ----------------------
-- Actualmente, al agregar un producto al carrito, el campo peso_kg NO se llena
-- automáticamente, lo que causa que el costo de envío sea $0.00 hasta que se
-- ejecute manualmente el script ACTUALIZAR_PESO_ITEMS_AHORA.sql
--
-- SOLUCIÓN:
-- ---------
-- Este trigger calcula y guarda el peso_kg AUTOMÁTICAMENTE cada vez que se
-- inserta o actualiza un item en el carrito, garantizando que el costo de
-- envío se calcule correctamente de inmediato (como Shein/Temu).
--
-- =============================================================================

-- Función que calcula el peso para un item del carrito
CREATE OR REPLACE FUNCTION fn_calculate_cart_item_weight()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo calcular si peso_kg es NULL o 0
  -- Esto permite que si alguien especifica un peso manualmente, se respete
  IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
    
    -- CASO 1: Item con VARIANTE
    -- Usar peso de variante primero, si no existe usar peso del producto
    IF NEW.variant_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(pv.peso_kg, 0),        -- 1. Peso de variante en kg
          NULLIF(p.peso_kg, 0),         -- 2. Peso de producto en kg
          pv.peso_g::numeric / 1000.0,  -- 3. Peso de variante en g → kg
          p.peso_g::numeric / 1000.0,   -- 4. Peso de producto en g → kg
          0.3                            -- 5. Default: 300g (0.3 kg)
        )
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = NEW.variant_id
      );
    
    -- CASO 2: Item SIN variante (producto simple)
    -- Usar peso del producto directamente
    ELSIF NEW.product_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(p.peso_kg, 0),         -- 1. Peso de producto en kg
          p.peso_g::numeric / 1000.0,   -- 2. Peso de producto en g → kg
          0.3                            -- 3. Default: 300g (0.3 kg)
        )
        FROM products p
        WHERE p.id = NEW.product_id
      );
    
    -- CASO 3: Sin variant_id ni product_id (casos edge)
    -- Usar peso default conservador
    ELSE
      NEW.peso_kg := 0.3;  -- 300 gramos por defecto
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calculate_cart_item_weight() IS 
  'Calcula automáticamente el peso_kg de un item al agregarlo al carrito.
   Prioridad de cálculo:
   1. Si tiene variante: peso_kg variante → peso_kg producto → peso_g variante → peso_g producto → 0.3kg
   2. Si no tiene variante: peso_kg producto → peso_g producto → 0.3kg
   Se ejecuta ANTES de INSERT/UPDATE para que el peso esté disponible inmediatamente.';

-- =============================================================================
-- Crear triggers para B2B y B2C
-- =============================================================================

-- Trigger para carrito B2B
DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2b_cart_items;

CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

COMMENT ON TRIGGER trigger_calculate_cart_item_weight ON b2b_cart_items IS 
  'Calcula peso_kg automáticamente para items B2B antes de insertar/actualizar';

-- Trigger para carrito B2C (mismo problema)
DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2c_cart_items;

CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

COMMENT ON TRIGGER trigger_calculate_cart_item_weight ON b2c_cart_items IS 
  'Calcula peso_kg automáticamente para items B2C antes de insertar/actualizar';

-- =============================================================================
-- Verificación de instalación
-- =============================================================================

SELECT 
  '✅ TRIGGERS INSTALADOS' as status,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_calculate_cart_item_weight'
ORDER BY event_object_table;

-- =============================================================================
-- TEST: Probar el trigger
-- =============================================================================

-- Test 1: Insertar item SIN especificar peso_kg
-- El trigger debe calcular automáticamente
DO $$
DECLARE
  v_cart_id UUID;
  v_product_id UUID;
  v_new_item_id UUID;
BEGIN
  -- Obtener un carrito abierto
  SELECT id INTO v_cart_id
  FROM b2b_carts
  WHERE status = 'open'
  LIMIT 1;
  
  -- Obtener un producto activo
  SELECT id INTO v_product_id
  FROM products
  WHERE is_active = TRUE
  LIMIT 1;
  
  IF v_cart_id IS NOT NULL AND v_product_id IS NOT NULL THEN
    -- Insertar item SIN especificar peso_kg
    INSERT INTO b2b_cart_items (
      cart_id, 
      product_id, 
      sku, 
      nombre, 
      quantity, 
      unit_price, 
      total_price
      -- ⚠️ NOTA: NO especificamos peso_kg, el trigger lo calculará
    )
    VALUES (
      v_cart_id,
      v_product_id,
      'TEST-TRIGGER-' || FLOOR(RANDOM() * 10000),
      'Producto Test Trigger',
      1,
      10.00,
      10.00
    )
    RETURNING id INTO v_new_item_id;
    
    -- Verificar que el peso se calculó
    RAISE NOTICE 'Test completado. Verifica el resultado abajo...';
  ELSE
    RAISE NOTICE 'No hay carritos abiertos o productos activos para testear';
  END IF;
END $$;

-- Ver resultado del test
SELECT 
  '🧪 RESULTADO DEL TEST' as info,
  bci.id,
  p.nombre as producto,
  bci.quantity as cantidad,
  p.peso_kg as peso_producto,
  p.peso_g as peso_producto_g,
  bci.peso_kg as "⭐ peso_calculado_automaticamente",
  CASE 
    WHEN bci.peso_kg IS NOT NULL AND bci.peso_kg > 0 
    THEN '✅ TRIGGER FUNCIONANDO'
    ELSE '❌ TRIGGER NO FUNCIONÓ'
  END as estado,
  bci.created_at
FROM b2b_cart_items bci
JOIN products p ON bci.product_id = p.id
WHERE bci.sku LIKE 'TEST-TRIGGER-%'
ORDER BY bci.created_at DESC
LIMIT 5;

-- =============================================================================
-- Limpiar datos de test (opcional)
-- =============================================================================
-- DELETE FROM b2b_cart_items WHERE sku LIKE 'TEST-TRIGGER-%';

-- =============================================================================
-- SIGUIENTE PASO
-- =============================================================================
/*
✅ TRIGGER INSTALADO CORRECTAMENTE

Ahora ejecuta:
  ACTUALIZAR_PESO_ITEMS_AHORA.sql
  
Para actualizar los items que ya están en carritos existentes.

Después de esto, TODOS los nuevos items que se agreguen al carrito
tendrán su peso calculado automáticamente.

VERIFICAR EN FRONTEND:
1. Agrega un producto al carrito
2. Revisa en la consola del navegador que peso_kg > 0
3. Verifica que el costo de envío se muestra inmediatamente
*/
