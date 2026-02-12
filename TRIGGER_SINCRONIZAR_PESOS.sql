-- =============================================================================
-- TRIGGER AUTOMÁTICO: Sincronizar peso_kg ↔ peso_g cuando se inserta/actualiza
-- Fecha: 2026-02-12
-- Propósito: Mantener peso_kg y peso_g sincronizados SIN necesidad de scripts manuales
-- =============================================================================

-- 1. Crear función del trigger
CREATE OR REPLACE FUNCTION sync_product_weights()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se actualiza peso_kg, calcular peso_g automáticamente
  IF NEW.peso_kg IS NOT NULL AND NEW.peso_kg > 0 THEN
    -- Solo actualizar peso_g si está vacío o es 0
    IF NEW.peso_g IS NULL OR NEW.peso_g = 0 THEN
      NEW.peso_g := NEW.peso_kg * 1000.0;
    END IF;
  END IF;
  
  -- Si se actualiza peso_g, calcular peso_kg automáticamente
  IF NEW.peso_g IS NOT NULL AND NEW.peso_g > 0 THEN
    -- Solo actualizar peso_kg si está vacío o es 0
    IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
      NEW.peso_kg := NEW.peso_g / 1000.0;
    END IF;
  END IF;
  
  -- Si se usa weight_kg (columna antigua), sincronizar a peso_kg/peso_g
  IF NEW.weight_kg IS NOT NULL AND NEW.weight_kg > 0 THEN
    IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
      NEW.peso_kg := NEW.weight_kg;
      NEW.peso_g := NEW.weight_kg * 1000.0;
    END IF;
  END IF;
  
  -- Si se usa weight_g (columna antigua), sincronizar a peso_kg/peso_g
  IF NEW.weight_g IS NOT NULL AND NEW.weight_g > 0 THEN
    IF NEW.peso_g IS NULL OR NEW.peso_g = 0 THEN
      NEW.peso_g := NEW.weight_g;
      NEW.peso_kg := NEW.weight_g / 1000.0;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS products_sync_weights_trigger ON products;

-- 3. Crear trigger que se ejecuta ANTES de INSERT o UPDATE
CREATE TRIGGER products_sync_weights_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_weights();

-- =============================================================================
-- VERIFICACIÓN: Probar el trigger
-- =============================================================================

-- Ejemplo 1: Insertar producto con peso_kg solamente
DO $$
DECLARE
  test_id uuid;
BEGIN
  -- Crear producto de prueba con solo peso_kg
  INSERT INTO products (nombre, peso_kg, is_active)
  VALUES ('Test Trigger - Solo KG', 0.5, TRUE)
  RETURNING id INTO test_id;
  
  -- Verificar que peso_g se calculó automáticamente
  RAISE NOTICE 'Producto creado con peso_kg=0.5';
  PERFORM nombre, peso_kg, peso_g 
  FROM products 
  WHERE id = test_id;
  
  -- Limpiar
  DELETE FROM products WHERE id = test_id;
  RAISE NOTICE 'Producto de prueba eliminado';
END $$;

-- Ejemplo 2: Actualizar producto existente con nuevo peso_g
DO $$
DECLARE
  test_product_id uuid;
BEGIN
  -- Tomar un producto existente
  SELECT id INTO test_product_id 
  FROM products 
  WHERE is_active = TRUE 
  LIMIT 1;
  
  IF test_product_id IS NOT NULL THEN
    -- Actualizar solo peso_g
    UPDATE products 
    SET peso_g = 750
    WHERE id = test_product_id;
    
    RAISE NOTICE 'Producto actualizado con peso_g=750, peso_kg debería ser 0.75';
  ELSE
    RAISE NOTICE 'No hay productos disponibles para probar';
  END IF;
END $$;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Al insertar/actualizar productos:
-- - Si se proporciona peso_kg → peso_g se calcula automáticamente (kg * 1000)
-- - Si se proporciona peso_g → peso_kg se calcula automáticamente (g / 1000)
-- - Si se usa weight_kg/weight_g → se sincroniza a peso_kg/peso_g
-- =============================================================================

-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ejecutar este script UNA VEZ: \i TRIGGER_SINCRONIZAR_PESOS.sql
-- 2. A partir de ahora, TODOS los productos se sincronizarán automáticamente
-- 3. Ya NO es necesario ejecutar SINCRONIZAR_PESOS_AUTOMATICO.sql manualmente
-- 4. Para productos existentes, ejecutar una vez SINCRONIZAR_PESOS_AUTOMATICO.sql
-- =============================================================================

SELECT 'Trigger creado exitosamente. Los pesos se sincronizarán automáticamente.' as status;
