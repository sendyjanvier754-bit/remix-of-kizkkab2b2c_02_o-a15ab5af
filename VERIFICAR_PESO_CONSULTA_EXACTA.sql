-- =============================================================================
-- VERIFICAR: Pesos reales de los productos del carrito
-- =============================================================================

-- PASO 1: Ver los productos específicos que están en el carrito
SELECT 
  '🔍 PRODUCTO BASE' as tipo,
  p.id,
  p.nombre,
  p.sku_interno,
  p.peso_kg as "peso_kg (products)",
  p.peso_g as "peso_g (products)",
  COALESCE(p.peso_kg, p.peso_g::numeric / 1000.0, 0) as "peso_calculado_kg",
  CASE 
    WHEN p.peso_kg IS NOT NULL THEN '✅ Tiene peso_kg'
    WHEN p.peso_g IS NOT NULL THEN '✅ Tiene peso_g'  
    ELSE '❌ SIN PESO'
  END as status
FROM products p
WHERE p.id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c';


-- PASO 2: Ver las variantes específicas
SELECT 
  '🔍 VARIANTES' as tipo,
  pv.id as variant_id,
  pv.product_id,
  pv.name as variant_name,
  pv.sku,
  pv.peso_kg as "peso_kg (variants)",
  pv.peso_g as "peso_g (variants)",
  p.peso_kg as "peso_kg (product_base)",
  p.peso_g as "peso_g (product_base)",
  -- Esta es la lógica EXACTA que usa la función
  COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) as "peso_calculado_kg",
  CASE 
    WHEN COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0) > 0 
    THEN '✅ OK' 
    ELSE '❌ SIN PESO'
  END as status
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.id IN (
  '30123456-0123-4567-8901-234567890123',
  '29012345-9012-3456-7890-123456789012'
);


-- PASO 3: Simular exactamente lo que hace calculate_cart_shipping_cost_dynamic
DO $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_weight NUMERIC;
  v_total_weight NUMERIC := 0;
  v_cart_items JSONB;
BEGIN
  -- Este es el carrito exacto del usuario
  v_cart_items := '[
    {"quantity":1,"product_id":"3f61c5dc-ed1c-491a-894e-44ae6d1e380c","variant_id":"30123456-0123-4567-8901-234567890123"},
    {"quantity":1,"product_id":"3f61c5dc-ed1c-491a-894e-44ae6d1e380c","variant_id":"29012345-9012-3456-7890-123456789012"}
  ]'::jsonb;
  
  RAISE NOTICE '=== SIMULACIÓN DE calculate_cart_shipping_cost_dynamic ===';
  RAISE NOTICE 'Cart items: %', v_cart_items;
  RAISE NOTICE '';
  
  -- Iterar sobre cada item (MISMA LÓGICA DE LA FUNCIÓN)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_cart_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := CASE 
      WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != 'null' 
      THEN (v_item->>'variant_id')::UUID 
      ELSE NULL 
    END;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    
    RAISE NOTICE 'Procesando item:';
    RAISE NOTICE '  product_id: %', v_product_id;
    RAISE NOTICE '  variant_id: %', v_variant_id;
    RAISE NOTICE '  quantity: %', v_quantity;
    
    -- Obtener peso (MISMA QUERY DE LA FUNCIÓN)
    IF v_variant_id IS NOT NULL THEN
      SELECT 
        COALESCE(pv.peso_kg, p.peso_kg, pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
      INTO v_weight
      FROM public.product_variants pv
      JOIN public.products p ON pv.product_id = p.id
      WHERE pv.id = v_variant_id;
      
      RAISE NOTICE '  → Peso obtenido de variante + producto: % kg', v_weight;
    ELSE
      SELECT 
        COALESCE(p.peso_kg, p.peso_g::numeric / 1000.0, 0)
      INTO v_weight
      FROM public.products p
      WHERE p.id = v_product_id;
      
      RAISE NOTICE '  → Peso obtenido de producto: % kg', v_weight;
    END IF;
    
    v_total_weight := v_total_weight + (COALESCE(v_weight, 0) * v_quantity);
    RAISE NOTICE '  → Peso acumulado total: % kg', v_total_weight;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '=== RESULTADO FINAL ===';
  RAISE NOTICE 'Peso total del carrito: % kg', v_total_weight;
  RAISE NOTICE 'Peso redondeado: % kg', CEIL(v_total_weight);
END $$;


-- PASO 4: Test directo con v_product_shipping_costs (para comparar)
SELECT 
  '📊 Comparación con v_product_shipping_costs' as info,
  product_id,
  product_name,
  weight_kg as peso_desde_vista,
  total_cost as costo_unitario
FROM v_product_shipping_costs
WHERE product_id = '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'
LIMIT 1;


-- =============================================================================
-- DIAGNÓSTICO
-- =============================================================================
/*
Este script verifica:
1. ✅ Peso en tabla products (product base)
2. ✅ Peso en tabla product_variants (variantes específicas)
3. ✅ Simulación exacta de calculate_cart_shipping_cost_dynamic
4. ✅ Comparación con v_product_shipping_costs

SI EL PASO 3 MUESTRA "Peso total: 0 kg":
=========================================
→ Los productos/variantes NO tienen peso_kg ni peso_g
→ Necesitas ejecutar: ACTUALIZAR_PESO_PRODUCTOS_CARRITO.sql

SI EL PASO 3 MUESTRA peso > 0:
===============================
→ Los productos SÍ tienen peso
→ El problema está en otro lado (RLS, permisos, etc)
→ Verificar con: DIAGNOSTICAR_COSTO_ENVIO_CERO.sql
*/
