-- =============================================================================
-- TRIGGER: Copiar peso del producto a variantes automáticamente
-- =============================================================================

-- Este trigger se ejecuta automáticamente cuando:
-- 1. Se crea una nueva variante SIN peso (INSERT)
-- 2. Se actualiza una variante y se borra su peso (UPDATE)
--
-- Si la variante NO tiene peso pero el producto SÍ, copia el peso automáticamente

-- =============================================================================
-- FUNCIÓN DEL TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_copy_weight_to_variant()
RETURNS TRIGGER AS $$
DECLARE
  v_product_peso_kg NUMERIC;
  v_product_peso_g INTEGER;
BEGIN
  -- Solo actuar si la variante NO tiene peso (o peso_kg = 0)
  IF (NEW.peso_kg IS NULL OR NEW.peso_kg = 0) AND NEW.peso_g IS NULL THEN
    
    -- Obtener peso del producto base
    SELECT peso_kg, peso_g 
    INTO v_product_peso_kg, v_product_peso_g
    FROM products 
    WHERE id = NEW.product_id;
    
    -- Si el producto tiene peso, copiarlo a la variante
    -- Usar peso_g si peso_kg es 0 o NULL
    IF v_product_peso_g IS NOT NULL AND v_product_peso_g > 0 THEN
      -- Copiar peso_g (en gramos) y convertir a peso_kg
      NEW.peso_g := v_product_peso_g;
      NEW.peso_kg := v_product_peso_g::numeric / 1000.0;
    ELSIF v_product_peso_kg IS NOT NULL AND v_product_peso_kg > 0 THEN
      -- Copiar peso_kg directamente
      NEW.peso_kg := v_product_peso_kg;
      
      RAISE NOTICE 'Auto-copiando peso del producto % a variante %: peso_kg=%, peso_g=%', 
        NEW.product_id, NEW.id, NEW.peso_kg, NEW.peso_g;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREAR TRIGGER
-- =============================================================================

-- Eliminar trigger si ya existe
DROP TRIGGER IF EXISTS trigger_auto_copy_weight_to_variant ON product_variants;

-- Crear trigger que se ejecuta ANTES de INSERT o UPDATE
CREATE TRIGGER trigger_auto_copy_weight_to_variant
  BEFORE INSERT OR UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION auto_copy_weight_to_variant();

COMMENT ON FUNCTION auto_copy_weight_to_variant IS 
  'Copia automáticamente el peso del producto base a las variantes que no tienen peso configurado';

-- =============================================================================
-- TESTING: Probar el trigger
-- =============================================================================

-- Test 1: Insertar una variante sin peso (debería copiar del producto)
DO $$
BEGIN
  -- Crear producto de prueba con peso
  INSERT INTO products (id, nombre, sku_interno, peso_kg, is_active)
  VALUES (
    'aaaaaaaa-1111-1111-1111-111111111111'::uuid,
    'Producto Test Trigger',
    'TEST-TRIGGER-001',
    0.25,
    true
  ) ON CONFLICT (id) DO UPDATE SET peso_kg = 0.25;
  
  -- Crear variante sin peso (trigger debería copiar peso)
  INSERT INTO product_variants (id, product_id, name, sku)
  VALUES (
    'bbbbbbbb-2222-2222-2222-222222222222'::uuid,
    'aaaaaaaa-1111-1111-1111-111111111111'::uuid,
    'Variante Test (sin peso)',
    'TEST-VAR-001'
  ) ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Test 1 completado: Variante creada';
END $$;

-- Verificar que se copió el peso
SELECT 
  '✅ Test 1: Verificar peso copiado' as test,
  pv.name as variant_name,
  pv.peso_kg as variant_peso_kg,
  p.peso_kg as product_peso_kg,
  CASE 
    WHEN pv.peso_kg = p.peso_kg THEN '✅ Peso copiado correctamente'
    WHEN pv.peso_kg IS NULL THEN '❌ Peso NO se copió'
    ELSE '⚠️ Peso diferente'
  END as resultado
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.id = 'bbbbbbbb-2222-2222-2222-222222222222'::uuid;


-- Test 2: Insertar variante con peso propio (NO debe sobreescribir)
DO $$
BEGIN
  -- Crear variante CON peso propio
  INSERT INTO product_variants (id, product_id, name, sku, peso_kg)
  VALUES (
    'cccccccc-3333-3333-3333-333333333333'::uuid,
    'aaaaaaaa-1111-1111-1111-111111111111'::uuid,
    'Variante Test (con peso propio)',
    'TEST-VAR-002',
    0.35  -- Peso diferente al producto
  ) ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Test 2 completado: Variante con peso propio creada';
END $$;

-- Verificar que mantuvo su peso propio
SELECT 
  '✅ Test 2: Verificar peso propio respetado' as test,
  pv.name as variant_name,
  pv.peso_kg as variant_peso_kg,
  p.peso_kg as product_peso_kg,
  CASE 
    WHEN pv.peso_kg = 0.35 THEN '✅ Peso propio respetado'
    WHEN pv.peso_kg = p.peso_kg THEN '❌ Peso fue sobrescrito'
    ELSE '⚠️ Peso inesperado'
  END as resultado
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.id = 'cccccccc-3333-3333-3333-333333333333'::uuid;


-- Test 3: Actualizar variante borrando su peso (debería copiar del producto)
DO $$
BEGIN
  -- Actualizar variante, borrando su peso
  UPDATE product_variants
  SET peso_kg = NULL, peso_g = NULL
  WHERE id = 'cccccccc-3333-3333-3333-333333333333'::uuid;
  
  RAISE NOTICE 'Test 3 completado: Peso de variante borrado';
END $$;

-- Verificar que se copió el peso del producto
SELECT 
  '✅ Test 3: Verificar peso copiado al actualizar' as test,
  pv.name as variant_name,
  pv.peso_kg as variant_peso_kg,
  p.peso_kg as product_peso_kg,
  CASE 
    WHEN pv.peso_kg = p.peso_kg THEN '✅ Peso copiado al actualizar'
    WHEN pv.peso_kg IS NULL THEN '❌ Peso NO se copió'
    ELSE '⚠️ Peso diferente'
  END as resultado
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.id = 'cccccccc-3333-3333-3333-333333333333'::uuid;


-- =============================================================================
-- LIMPIAR DATOS DE TEST
-- =============================================================================

-- Eliminar datos de prueba
DELETE FROM product_variants 
WHERE product_id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid;

DELETE FROM products 
WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid;


-- =============================================================================
-- RESULTADO ESPERADO
-- =============================================================================
/*
COMPORTAMIENTO DEL TRIGGER:
===========================

CASO 1: Nueva variante SIN peso
--------------------------------
Producto: peso_kg = 0.25
Variante nueva: peso_kg = NULL
Resultado: peso_kg = 0.25 (copiado) ✅

CASO 2: Nueva variante CON peso propio
---------------------------------------
Producto: peso_kg = 0.25
Variante nueva: peso_kg = 0.35
Resultado: peso_kg = 0.35 (respetado) ✅

CASO 3: Actualizar variante borrando peso
------------------------------------------
Producto: peso_kg = 0.25
Variante: peso_kg = 0.35 → NULL
Resultado: peso_kg = 0.25 (copiado) ✅

CASO 4: Producto sin peso
--------------------------
Producto: peso_kg = NULL
Variante nueva: peso_kg = NULL
Resultado: peso_kg = NULL (sin cambios)

VENTAJAS:
=========
✅ Automático: No necesitas ejecutar scripts manualmente
✅ Consistente: Todas las variantes nuevas tendrán peso
✅ Flexible: Respeta peso propio de variantes
✅ Retroactivo: Funciona al actualizar variantes existentes
✅ Transparente: Se ejecuta silenciosamente en segundo plano

NOTA:
=====
Para variantes EXISTENTES sin peso, ejecutar una vez:
ACTUALIZAR_TODAS_VARIANTES_SIN_PESO.sql

A partir de ahora, todas las variantes NUEVAS tendrán peso automáticamente.
*/
