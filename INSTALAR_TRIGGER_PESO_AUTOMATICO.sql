-- =============================================================================
-- TRIGGER: Actualizar peso_kg automáticamente al agregar item al carrito
-- =============================================================================
-- Este trigger SOLO copia el peso del producto/variante al item del carrito
-- No hace cálculos, solo actualiza la BD para que no tengas que hacerlo manual
-- =============================================================================

-- Paso 1: Crear la función que actualiza el peso
-- ===============================================
CREATE OR REPLACE FUNCTION fn_auto_set_peso_kg()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el peso_kg ya está lleno, no hacer nada
  IF NEW.peso_kg IS NOT NULL AND NEW.peso_kg > 0 THEN
    RETURN NEW;
  END IF;

  -- Si tiene variant_id: usar peso de la variante
  -- MISMA LÓGICA que ACTUALIZAR_PESO_ITEMS_AHORA.sql
  IF NEW.variant_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(pv.peso_kg, 0),           -- Peso de variante en kg
      NULLIF(p.peso_kg, 0),            -- Peso de producto en kg
      pv.peso_g::numeric / 1000.0,     -- Convertir g a kg de variante
      p.peso_g::numeric / 1000.0,      -- Convertir g a kg de producto
      0                                 -- Default: 0 (igual que el query manual)
    )
    INTO NEW.peso_kg
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.id = NEW.variant_id;
  
  -- Si NO tiene variante: usar peso del producto directamente
  -- MISMA LÓGICA que ACTUALIZAR_PESO_ITEMS_AHORA.sql
  ELSIF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(p.peso_kg, 0),            -- Peso de producto en kg
      p.peso_g::numeric / 1000.0,      -- Convertir g a kg
      0                                 -- Default: 0 (igual que el query manual)
    )
    INTO NEW.peso_kg
    FROM products p
    WHERE p.id = NEW.product_id;
  
  -- Si no tiene ni variant_id ni product_id: peso 0
  ELSE
    NEW.peso_kg := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 2: Crear trigger SOLO para B2B
-- =====================================

-- Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS trg_auto_peso_b2b ON b2b_cart_items;

-- Crear trigger para B2B
CREATE TRIGGER trg_auto_peso_b2b
  BEFORE INSERT OR UPDATE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_peso_kg();

-- Paso 3: Verificar que se instaló correctamente
-- ===============================================
SELECT 
  '✅ TRIGGER INSTALADO' as status,
  trigger_name as trigger,
  event_object_table as tabla,
  action_timing as cuando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_peso_b2b';

-- =============================================================================
-- ¡LISTO! Ahora cuando agregues productos al carrito B2B, el peso se actualiza solo
-- =============================================================================

/*

PRÓXIMOS PASOS:

1. ✅ Ya instalaste el trigger (acabas de ejecutar este script)

2. Actualiza los items B2B existentes que tienen peso_kg = NULL:
   → Ejecuta: ACTUALIZAR_PESO_ITEMS_AHORA.sql (una sola vez)

3. Prueba agregando un producto al carrito B2B desde tu aplicación
   → El peso_kg debe aparecer automáticamente

4. Verifica:
   SELECT id, sku, nombre, quantity, peso_kg 
   FROM b2b_cart_items 
   WHERE cart_id = 'TU_CART_ID'
   ORDER BY created_at DESC 
   LIMIT 5;

*/
