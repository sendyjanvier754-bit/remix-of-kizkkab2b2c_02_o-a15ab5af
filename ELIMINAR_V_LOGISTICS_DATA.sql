-- =============================================================================
-- FASE FINAL: ELIMINAR v_logistics_data
-- Fecha: 2026-02-11 (después de verificación)
-- Propósito: Eliminar la vista v_logistics_data ya que las funciones RPC
--            y los hooks React consultarán directamente la tabla products
-- =============================================================================

-- ============================================================================
-- PARTE 0: VERIFICACIÓN PREVIA (Ejecutar ANTES de eliminar)
-- ============================================================================

/*
VERIFICACIÓN: Asegúrate de que NADA depende de v_logistics_data

Ejecuta esta query para verificar dependencias:

SELECT 
  t.tablename, 
  pg_get_viewdef(t.oid) as definition
FROM pg_tables t
WHERE t.tablename = 'v_logistics_data'
  AND t.schemaname = 'public';

Si retorna 0 filas, la vista YA FUE ELIMINADA.
Si retorna 1 fila, continúa con la eliminación.

TAMBIÉN VERIFICA en el código React que NINGÚN hook importa v_logistics_data:

  grep -r "v_logistics_data" src/hooks/
  grep -r "v_logistics_data" src/components/

Si no retorna resultados, está seguro eliminar.
*/

-- ============================================================================
-- PARTE 1: ELIMINAR LA VISTA v_logistics_data
-- ============================================================================

DROP VIEW IF EXISTS public.v_logistics_data CASCADE;

COMMENT ON VIEW public.v_logistics_data IS NULL;

-- ============================================================================
-- PARTE 2: VERIFICACIÓN POSTERIOR
-- ============================================================================

-- Verificar que la vista fue eliminada
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'v_logistics_data'
  AND table_schema = 'public';

-- ============================================================================
-- PARTE 3: INFORMACIÓN - CÓMO CONSULTAR products DIRECTAMENTE
-- ============================================================================

/*
AHORA, los hooks React deben consultar DIRECTAMENTE de la tabla products:

OPCIÓN A: Para un producto individual

  const { data: productData } = await supabase
    .from('products')
    .select(
      'id, ' +
      'COALESCE(weight_kg, peso_kg, weight_g / 1000.0, peso_g / 1000.0) as weight_kg, ' +
      'is_oversize, ' +
      'length_cm, width_cm, height_cm'
    )
    .eq('id', productId)
    .eq('is_active', true)
    .single();

OPCIÓN B: Para múltiples productos (carrito)

  const { data: productsData } = await supabase
    .from('products')
    .select(
      'id, ' +
      'COALESCE(weight_kg, peso_kg, weight_g / 1000.0, peso_g / 1000.0) as weight_kg, ' +
      'is_oversize, ' +
      'length_cm, width_cm, height_cm'
    )
    .in('id', productIds)
    .eq('is_active', true);

OPCIÓN C: Productos + Variantes (para carrito completo)

  const { data: itemsData } = await supabase
    .from('products')
    .select(
      'id as product_id, ' +
      'NULL::uuid as variant_id, ' +
      'COALESCE(weight_kg, peso_kg, weight_g / 1000.0, peso_g / 1000.0) as weight_kg, ' +
      'is_oversize, ' +
      'length_cm, width_cm, height_cm'
    )
    .in('id', productIds)
    .eq('is_active', true);

  const { data: variantsData } = await supabase
    .from('product_variants')
    .select(
      'id as variant_id, ' +
      'product_id, ' +
      'products!inner(weight_kg, peso_kg, weight_g, peso_g, is_oversize, length_cm, width_cm, height_cm)'
    )
    .in('id', variantIds)
    .eq('is_active', true)
    .eq('products.is_active', true);

  // Combinar y transformar
  const allItems = [
    ...itemsData.map(p => ({
      product_id: p.product_id,
      variant_id: null,
      weight_kg: p.weight_kg,
      is_oversize: p.is_oversize,
      length_cm: p.length_cm,
      width_cm: p.width_cm,
      height_cm: p.height_cm
    })),
    ...variantsData.map(v => ({
      product_id: v.product_id,
      variant_id: v.variant_id,
      weight_kg: v.products.weight_kg || v.products.peso_kg || (v.products.weight_g / 1000) || (v.products.peso_g / 1000),
      is_oversize: v.products.is_oversize,
      length_cm: v.products.length_cm,
      width_cm: v.products.width_cm,
      height_cm: v.products.height_cm
    }))
  ];
*/

-- ============================================================================
-- PARTE 4: SQL ÚTIL - Consulta directa que reemplaza v_logistics_data
-- ============================================================================

/*
Si necesitas una "vista similar" a v_logistics_data pero sin overhead,
puedes crear este QUERY REUTILIZABLE en los hooks React:

-- Forma 1: Raw SQL (para Supabase)
SELECT 
  p.id as product_id,
  NULL::uuid as variant_id,
  p.nombre as item_name,
  p.sku_interno as sku,
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.is_active
FROM products p
WHERE p.is_active = TRUE AND p.id IN ({product_ids})

UNION ALL

SELECT 
  pv.product_id,
  pv.id as variant_id,
  p.nombre || ' - ' || pv.name as item_name,
  pv.sku,
  COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0, 0) as weight_kg,
  p.is_oversize,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  pv.is_active
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = TRUE AND pv.id IN ({variant_ids});
*/

-- ============================================================================
-- PARTE 5: CONFIRMACIÓN
-- ============================================================================

-- Mensaje de confirmación
SELECT 
  'Vista v_logistics_data eliminada exitosamente' as status,
  NOW() as timestamp,
  'Los hooks React deben consultar directamente products table' as next_step;
