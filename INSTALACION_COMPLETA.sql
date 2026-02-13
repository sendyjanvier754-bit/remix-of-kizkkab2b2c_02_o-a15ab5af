-- =============================================================================
-- INSTALACIÓN TODO-EN-UNO: Actualización Automática de Peso y Costo de Envío
-- =============================================================================
--
-- Este script ejecuta TODOS los pasos necesarios en orden:
-- 1. Instala triggers de cálculo de peso automático
-- 2. Actualiza items existentes en carritos
-- 3. Instala triggers de actualización de costo total (opcional)
-- 4. Verifica la instalación
--
-- TIEMPO ESTIMADO: 5 minutos
--
-- REQUISITOS:
-- - Permisos de superusuario o CREATEDB
-- - Base de datos con tablas b2b_carts, b2b_cart_items, b2c_carts, b2c_cart_items
--
-- EJECUCIÓN:
-- psql -U postgres -d tu_base_de_datos -f INSTALACION_COMPLETA.sql
--
-- =============================================================================

\echo ''
\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║                                                                        ║'
\echo '║  INSTALACIÓN: Actualización Automática de Peso y Costo de Envío       ║'
\echo '║                                                                        ║'
\echo '║  Este script instalará triggers que:                                  ║'
\echo '║  ✅ Calculan peso automáticamente al agregar items al carrito         ║'
\echo '║  ✅ Actualizan costo de envío en tiempo real                          ║'
\echo '║  ✅ Eliminan la necesidad de scripts manuales                         ║'
\echo '║                                                                        ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''
\echo 'Presiona Ctrl+C para cancelar, o Enter para continuar...'
\prompt '> ' dummy

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📦 PASO 1/5: Preparando base de datos...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Verificar que las tablas existen
DO $$
DECLARE
  v_missing_tables TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_carts') THEN
    v_missing_tables := array_append(v_missing_tables, 'b2b_carts');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_cart_items') THEN
    v_missing_tables := array_append(v_missing_tables, 'b2b_cart_items');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2c_carts') THEN
    v_missing_tables := array_append(v_missing_tables, 'b2c_carts');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2c_cart_items') THEN
    v_missing_tables := array_append(v_missing_tables, 'b2c_cart_items');
  END IF;
  
  IF array_length(v_missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Tablas faltantes: %. Verifica tu base de datos.', array_to_string(v_missing_tables, ', ');
  END IF;
  
  RAISE NOTICE '✅ Todas las tablas necesarias existen';
END $$;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔧 PASO 2/5: Instalando triggers de cálculo de peso automático...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Verificar que peso_kg existe en cart_items
DO $$
BEGIN
  -- Agregar peso_kg si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2b_cart_items' AND column_name = 'peso_kg'
  ) THEN
    ALTER TABLE b2b_cart_items ADD COLUMN peso_kg NUMERIC(10,3) DEFAULT NULL;
    RAISE NOTICE '✅ Columna peso_kg agregada a b2b_cart_items';
  ELSE
    RAISE NOTICE '✅ Columna peso_kg ya existe en b2b_cart_items';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2c_cart_items' AND column_name = 'peso_kg'
  ) THEN
    ALTER TABLE b2c_cart_items ADD COLUMN peso_kg NUMERIC(10,3) DEFAULT NULL;
    RAISE NOTICE '✅ Columna peso_kg agregada a b2c_cart_items';
  ELSE
    RAISE NOTICE '✅ Columna peso_kg ya existe en b2c_cart_items';
  END IF;
END $$;

-- Función que calcula el peso para un item del carrito
CREATE OR REPLACE FUNCTION fn_calculate_cart_item_weight()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
    IF NEW.variant_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(pv.peso_kg, 0),
          NULLIF(p.peso_kg, 0),
          pv.peso_g::numeric / 1000.0,
          p.peso_g::numeric / 1000.0,
          0.3
        )
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = NEW.variant_id
      );
    ELSIF NEW.product_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(p.peso_kg, 0),
          p.peso_g::numeric / 1000.0,
          0.3
        )
        FROM products p
        WHERE p.id = NEW.product_id
      );
    ELSE
      NEW.peso_kg := 0.3;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2b_cart_items;
CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2c_cart_items;
CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

\echo '✅ Función fn_calculate_cart_item_weight() creada'
\echo '✅ Triggers instalados en b2b_cart_items y b2c_cart_items'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📝 PASO 3/5: Actualizando items existentes en carritos...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Actualizar items B2B existentes
UPDATE b2b_cart_items bci
SET peso_kg = (
  CASE 
    WHEN bci.variant_id IS NOT NULL THEN
      (SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), 
                       pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0.3)
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = bci.variant_id)
    ELSE
      (SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0.3)
       FROM products p
       WHERE p.id = bci.product_id)
  END
)
FROM b2b_carts bc
WHERE bci.cart_id = bc.id
  AND bc.status = 'open'
  AND (bci.peso_kg IS NULL OR bci.peso_kg = 0);

-- Actualizar items B2C existentes
UPDATE b2c_cart_items bci
SET peso_kg = (
  CASE 
    WHEN bci.variant_id IS NOT NULL THEN
      (SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), 
                       pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0.3)
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = bci.variant_id)
    ELSE
      (SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0.3)
       FROM products p
       WHERE p.id = bci.product_id)
  END
)
FROM b2c_carts bc
WHERE bci.cart_id = bc.id
  AND bc.status = 'open'
  AND (bci.peso_kg IS NULL OR bci.peso_kg = 0);

-- Mostrar resumen
DO $$
DECLARE
  v_b2b_updated INT;
  v_b2c_updated INT;
BEGIN
  SELECT COUNT(*) INTO v_b2b_updated
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.status = 'open' AND bci.peso_kg IS NOT NULL AND bci.peso_kg > 0;
  
  SELECT COUNT(*) INTO v_b2c_updated
  FROM b2c_cart_items bci
  JOIN b2c_carts bc ON bci.cart_id = bc.id
  WHERE bc.status = 'open' AND bci.peso_kg IS NOT NULL AND bci.peso_kg > 0;
  
  RAISE NOTICE '✅ Items B2B con peso calculado: %', v_b2b_updated;
  RAISE NOTICE '✅ Items B2C con peso calculado: %', v_b2c_updated;
END $$;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '💰 PASO 4/5: Instalando triggers de costo total (OPCIONAL)...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Agregar columnas a carritos
ALTER TABLE b2b_carts
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shipping_update TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE b2c_carts
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shipping_update TIMESTAMPTZ DEFAULT NOW();

\echo '✅ Columnas agregadas a b2b_carts y b2c_carts'

-- Función para actualizar costo de envío
CREATE OR REPLACE FUNCTION fn_update_cart_shipping_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cart_id UUID;
  v_total_weight NUMERIC;
  v_shipping_cost NUMERIC;
  v_cart_table TEXT;
BEGIN
  IF TG_TABLE_NAME = 'b2b_cart_items' THEN
    v_cart_table := 'b2b_carts';
  ELSE
    v_cart_table := 'b2c_carts';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    v_cart_id := OLD.cart_id;
  ELSE
    v_cart_id := NEW.cart_id;
  END IF;
  
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
  
  IF v_total_weight = 0 THEN
    v_shipping_cost := 0;
  ELSIF CEIL(v_total_weight) <= 1 THEN
    v_shipping_cost := 11.05;
  ELSE
    v_shipping_cost := 11.05 + ((CEIL(v_total_weight) - 1) * 5.82);
  END IF;
  
  IF v_cart_table = 'b2b_carts' THEN
    UPDATE b2b_carts
    SET total_weight_kg = v_total_weight,
        shipping_cost_usd = v_shipping_cost,
        last_shipping_update = NOW()
    WHERE id = v_cart_id;
  ELSE
    UPDATE b2c_carts
    SET total_weight_kg = v_total_weight,
        shipping_cost_usd = v_shipping_cost,
        last_shipping_update = NOW()
    WHERE id = v_cart_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2b_cart_items;
CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost();

DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2c_cart_items;
CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost();

\echo '✅ Función fn_update_cart_shipping_cost() creada'
\echo '✅ Triggers instalados en b2b_cart_items y b2c_cart_items'

-- Actualizar carritos existentes
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
         WHERE bci.cart_id = bc.id), 0
      ) = 0 THEN 0
      WHEN CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2b_cart_items bci
         WHERE bci.cart_id = bc.id), 0
      )) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2b_cart_items bci
         WHERE bci.cart_id = bc.id), 0
      )) - 1) * 5.82)
    END
  ),
  last_shipping_update = NOW()
WHERE bc.status = 'open';

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
         WHERE bci.cart_id = bc.id), 0
      ) = 0 THEN 0
      WHEN CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2c_cart_items bci
         WHERE bci.cart_id = bc.id), 0
      )) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(COALESCE(
        (SELECT SUM(COALESCE(bci.peso_kg, 0) * COALESCE(bci.quantity, 1))
         FROM b2c_cart_items bci
         WHERE bci.cart_id = bc.id), 0
      )) - 1) * 5.82)
    END
  ),
  last_shipping_update = NOW()
WHERE bc.status = 'open';

\echo '✅ Carritos B2B y B2C actualizados con costos calculados'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 PASO 5/5: Verificando instalación...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Verificar triggers
SELECT 
  trigger_name as "Trigger Instalado",
  event_object_table as "En Tabla"
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_calculate_cart_item_weight',
  'trigger_update_cart_shipping'
)
ORDER BY event_object_table, trigger_name;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Resumen final
DO $$
DECLARE
  v_trigger_count INT;
  v_b2b_items_with_weight INT;
  v_b2c_items_with_weight INT;
  v_b2b_carts_with_cost INT;
  v_b2c_carts_with_cost INT;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('trigger_calculate_cart_item_weight', 'trigger_update_cart_shipping');
  
  SELECT COUNT(*) INTO v_b2b_items_with_weight
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bc.status = 'open' AND bci.peso_kg > 0;
  
  SELECT COUNT(*) INTO v_b2c_items_with_weight
  FROM b2c_cart_items bci
  JOIN b2c_carts bc ON bci.cart_id = bc.id
  WHERE bc.status = 'open' AND bci.peso_kg > 0;
  
  SELECT COUNT(*) INTO v_b2b_carts_with_cost
  FROM b2b_carts
  WHERE status = 'open' AND shipping_cost_usd > 0;
  
  SELECT COUNT(*) INTO v_b2c_carts_with_cost
  FROM b2c_carts
  WHERE status = 'open' AND shipping_cost_usd > 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅✅✅  INSTALACIÓN COMPLETADA EXITOSAMENTE  ✅✅✅                   ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'RESUMEN:';
  RAISE NOTICE '--------';
  RAISE NOTICE '  • Triggers instalados: % / 4', v_trigger_count;
  RAISE NOTICE '  • Items B2B con peso: %', v_b2b_items_with_weight;
  RAISE NOTICE '  • Items B2C con peso: %', v_b2c_items_with_weight;
  RAISE NOTICE '  • Carritos B2B con costo: %', v_b2b_carts_with_cost;
  RAISE NOTICE '  • Carritos B2C con costo: %', v_b2c_carts_with_cost;
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '---------------';
  RAISE NOTICE '  1. Prueba agregando un producto al carrito desde la UI';
  RAISE NOTICE '  2. Verifica que el costo de envío se muestra inmediatamente';
  RAISE NOTICE '  3. Revisa la consola del navegador: peso_kg debe ser > 0';
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICACIÓN RÁPIDA:';
  RAISE NOTICE '--------------------';
  RAISE NOTICE '  SELECT id, total_weight_kg, shipping_cost_usd';
  RAISE NOTICE '  FROM b2b_carts';
  RAISE NOTICE '  WHERE status = ''open'';';
  RAISE NOTICE '';
  
  IF v_trigger_count = 4 THEN
    RAISE NOTICE '✅ Todos los triggers instalados correctamente';
  ELSE
    RAISE WARNING '⚠️  Faltan triggers por instalar (esperado: 4, encontrado: %)', v_trigger_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════════════';
END $$;

\echo ''
