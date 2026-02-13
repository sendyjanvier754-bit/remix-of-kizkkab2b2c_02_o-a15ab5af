-- =============================================================================
-- FUNCIÓN HELPER: Obtener peso de un producto/variante ESPECÍFICO
-- =============================================================================
--
-- Esta función será llamada desde TypeScript para obtener el peso EXACTO
-- de una variante específica (o producto si no hay variante) antes de 
-- insertar en b2b_cart_items
--
-- IMPORTANTE:
-- - Si pasa variant_id → retorna peso de ESA variante específica
-- - Si variant_id es NULL → retorna peso del producto base
-- - Cada variante puede tener peso diferente
-- - Usa la lógica COALESCE: variante.peso_kg → producto.peso_kg → variante.peso_g/1000 → producto.peso_g/1000
--
-- =============================================================================

CREATE OR REPLACE FUNCTION get_product_weight(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_weight NUMERIC;
BEGIN
  -- Calcular peso directamente desde las tablas con lógica COALESCE
  -- Prioridad: variante.peso_kg → producto.peso_kg → variante.peso_g/1000 → producto.peso_g/1000
  
  IF p_variant_id IS NOT NULL THEN
    -- Item con variante: usar COALESCE completo
    -- NULLIF trata 0 como NULL para que revise peso_g cuando peso_kg = 0
    SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0)
    INTO v_weight
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.id = p_variant_id;
  ELSE
    -- Item sin variante: solo peso del producto
    SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0)
    INTO v_weight
    FROM products p
    WHERE p.id = p_product_id;
  END IF;
  
  RETURN COALESCE(v_weight, 0);
END $$;

COMMENT ON FUNCTION get_product_weight IS 
  'Obtiene el peso calculado de un producto/variante específico. Usa COALESCE: pv.peso_kg → p.peso_kg → pv.peso_g/1000 → p.peso_g/1000';

-- Test de la función con productos reales del carrito
SELECT 
  '🧪 TEST get_product_weight' as info,
  p.id as product_id,
  p.nombre as product_name,
  p.peso_kg as producto_peso_kg,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.peso_kg as variante_peso_kg,
  get_product_weight(p.id, pv.id) as peso_calculado,
  CASE 
    WHEN get_product_weight(p.id, pv.id) > 0 THEN '✅ TIENE PESO'
    ELSE '❌ SIN PESO'
  END as resultado
FROM b2b_cart_items bci
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bci.cart_id IN (
  SELECT id FROM b2b_carts 
  WHERE buyer_user_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
)
LIMIT 10;

-- =============================================================================
-- USO EN TYPESCRIPT
-- =============================================================================
/*
// En useB2BCartSupabase.ts - antes de insertar el item:

const addItem = useCallback(async (item: {
  productId: string;
  variantId?: string | null;  // ✅ ID específico de la variante
  sku: string;
  nombre: string;
  unitPrice: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}) => {
  if (!cart.id) return;

  try {
    // 1. Obtener peso ESPECÍFICO de esta variante (o producto si no hay variante)
    const { data: weightData, error: weightError } = await supabase
      .rpc('get_product_weight', {
        p_product_id: item.productId,
        p_variant_id: item.variantId || null  // ✅ Pasa el variant_id específico
      });

    if (weightError) {
      console.error('Error getting product weight:', weightError);
    }

    const peso_kg = weightData || 0;

    console.log(`📦 Adding ${item.sku} (variant: ${item.variantId || 'none'}) with weight: ${peso_kg} kg`);

    // 2. Insertar item CON el peso específico de esta variante
    const { error } = await supabase
      .from('b2b_cart_items')
      .insert({
        cart_id: cart.id,
        product_id: item.productId,
        variant_id: item.variantId || null,  // ✅ Guarda variant_id específico
        sku: item.sku,
        nombre: item.nombre,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        total_price: item.quantity * item.unitPrice,
        peso_kg: peso_kg,  // ✅ Peso específico de ESTA variante
        color: item.color || null,
        size: item.size || null,
      });

    if (error) throw error;

    await fetchOrCreateCart();
    toast.success('Producto agregado al carrito');
  } catch (error) {
    console.error('Error adding item:', error);
    toast.error('Error al agregar producto');
  }
}, [cart.id, fetchOrCreateCart]);

// EJEMPLO REAL:
// =============
// Producto: Camiseta (id: xxx, peso base: 0.2 kg)
// Variante S (id: aaa): peso_kg = 0.18 kg
// Variante M (id: bbb): peso_kg = 0.2 kg (usa peso del producto)
// Variante XL (id: ccc): peso_kg = 0.25 kg
//
// Al agregar al carrito:
// addItem({ productId: 'xxx', variantId: 'aaa', ... }) → guarda peso_kg = 0.18
// addItem({ productId: 'xxx', variantId: 'bbb', ... }) → guarda peso_kg = 0.2
// addItem({ productId: 'xxx', variantId: 'ccc', ... }) → guarda peso_kg = 0.25
//
// Cada fila del carrito tendrá el peso correcto de su variante específica ✅

// Cálculo de shipping ahora es simple:
SELECT 
  SUM(bci.peso_kg * bci.quantity) as total_weight_kg
FROM b2b_cart_items bci
WHERE bci.cart_id = ?
-- Resultado: 0.18 + 0.2 + 0.25 = 0.63 kg → 1 kg redondeado → $11.05
*/
