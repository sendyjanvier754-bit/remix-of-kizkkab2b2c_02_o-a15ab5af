-- =============================================================================
-- FUNCIÓN: Calcular Peso Real del Producto en el Carrito (SIN Redondear)
-- Archivo: FUNCION_CALCULAR_PESO_REAL_CATALOGO.sql
-- Propósito: Obtener peso exacto de un producto para mostrar en catálogo del seller
-- Fecha: 2026-02-19
-- =============================================================================

-- ============================================================================
-- FUNCIÓN 1: Calcular peso real por Product ID (suma todos los items)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_real_weight_by_product(
  p_product_id UUID
)
RETURNS TABLE (
  product_id UUID,
  total_quantity INTEGER,
  total_weight_kg NUMERIC,
  weight_rounded_kg NUMERIC,
  items_count INTEGER
) AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_qty INTEGER;
  v_items_count INTEGER;
BEGIN
  -- Sumar peso × cantidad de TODOS los items de este producto en carritos abiertos
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COALESCE(SUM(bci.quantity), 0),
    COUNT(DISTINCT bci.id)
  INTO v_total_weight, v_total_qty, v_items_count
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.product_id = p_product_id
    AND bc.status = 'open';

  RETURN QUERY SELECT 
    p_product_id,
    COALESCE(v_total_qty, 0)::INTEGER,
    ROUND(COALESCE(v_total_weight, 0)::NUMERIC, 3), -- Peso real SIN redondear
    CEIL(COALESCE(v_total_weight, 0))::NUMERIC,     -- Peso redondeado solo para referencia
    COALESCE(v_items_count, 0)::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_real_weight_by_product IS 
  'Calcula peso real de un producto en todos los carritos abiertos. NO redondea el peso.';

---

-- ============================================================================
-- FUNCIÓN 2: Calcular peso real por Product ID + Variant ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_real_weight_by_variant(
  p_product_id UUID,
  p_variant_id UUID
)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  total_quantity INTEGER,
  total_weight_kg NUMERIC,
  weight_rounded_kg NUMERIC,
  items_count INTEGER
) AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_qty INTEGER;
  v_items_count INTEGER;
BEGIN
  -- Sumar peso × cantidad de items específicos de esta variante en carritos abiertos
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COALESCE(SUM(bci.quantity), 0),
    COUNT(DISTINCT bci.id)
  INTO v_total_weight, v_total_qty, v_items_count
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.product_id = p_product_id
    AND bci.variant_id = p_variant_id
    AND bc.status = 'open';

  RETURN QUERY SELECT 
    p_product_id,
    p_variant_id,
    COALESCE(v_total_qty, 0)::INTEGER,
    ROUND(COALESCE(v_total_weight, 0)::NUMERIC, 3), -- Peso real SIN redondear
    CEIL(COALESCE(v_total_weight, 0))::NUMERIC,     -- Peso redondeado solo para referencia
    COALESCE(v_items_count, 0)::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_real_weight_by_variant IS 
  'Calcula peso real de una variante específica en todos los carritos abiertos. NO redondea el peso.';

---

-- ============================================================================
-- FUNCIÓN 3: Obtener detalles completos con precios (para Mi Catálogo)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_catalog_product_weight_details(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name VARCHAR,
  variant_id UUID,
  variant_name VARCHAR,
  total_units_in_cart INTEGER,
  weight_per_unit_kg NUMERIC,
  total_weight_kg NUMERIC,
  total_weight_rounded_kg NUMERIC,
  cost_per_unit NUMERIC,
  total_cost NUMERIC,
  cart_count INTEGER
) AS $$
DECLARE
  v_variant_id UUID;
BEGIN
  -- Si no se proporciona variant_id, usar NULL (para productos sin variantes)
  v_variant_id := COALESCE(p_variant_id, NULL);

  RETURN QUERY
  SELECT 
    bci.product_id,
    p.nombre,
    bci.variant_id,
    COALESCE(pv.name, 'N/A')::VARCHAR,
    COALESCE(SUM(bci.quantity), 0)::INTEGER,
    bci.peso_kg,
    ROUND(COALESCE(SUM(bci.peso_kg * bci.quantity), 0)::NUMERIC, 3),
    CEIL(COALESCE(SUM(bci.peso_kg * bci.quantity), 0))::NUMERIC,
    bci.unit_price,
    ROUND(COALESCE(SUM(bci.quantity * bci.unit_price), 0)::NUMERIC, 2),
    COUNT(DISTINCT bc.id)::INTEGER
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  JOIN products p ON bci.product_id = p.id
  LEFT JOIN product_variants pv ON bci.variant_id = pv.id
  WHERE bci.product_id = p_product_id
    AND (p_variant_id IS NULL OR bci.variant_id = p_variant_id)
    AND bc.status = 'open'
  GROUP BY 
    bci.product_id, 
    p.nombre, 
    bci.variant_id, 
    pv.name,
    bci.peso_kg,
    bci.unit_price;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_catalog_product_weight_details IS 
  'Obtiene detalles completos del peso, precio y cantidad de un producto/variante en el carrito para mostrar en Mi Catálogo.';

---

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista 1: Peso de todos los productos en carritos abiertos
CREATE OR REPLACE VIEW v_catalog_product_weights AS
SELECT 
  bci.product_id,
  p.nombre as product_name,
  COUNT(DISTINCT bci.id)::INTEGER as items_in_carts,
  COALESCE(SUM(bci.quantity), 0)::INTEGER as total_quantity,
  ROUND(COALESCE(SUM(bci.peso_kg * bci.quantity), 0)::NUMERIC, 3) as total_weight_real_kg,
  CEIL(COALESCE(SUM(bci.peso_kg * bci.quantity), 0))::NUMERIC as total_weight_rounded_kg,
  COUNT(DISTINCT bc.id)::INTEGER as carts_with_product,
  MAX(bc.updated_at) as last_updated
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
WHERE bc.status = 'open'
GROUP BY 
  bci.product_id,
  p.nombre
ORDER BY total_quantity DESC;

COMMENT ON VIEW v_catalog_product_weights IS 
  'Vista que muestra peso real (sin redondear) de cada producto en todos los carritos abiertos.';

---

-- Vista 2: Peso por producto Y variante
CREATE OR REPLACE VIEW v_catalog_variant_weights AS
SELECT 
  bci.product_id,
  p.nombre as product_name,
  bci.variant_id,
  COALESCE(pv.name, 'Sin Variante') as variant_name,
  bci.peso_kg as weight_per_unit_kg,
  COALESCE(SUM(bci.quantity), 0)::INTEGER as total_quantity,
  ROUND(COALESCE(SUM(bci.peso_kg * bci.quantity), 0)::NUMERIC, 3) as total_weight_real_kg,
  CEIL(COALESCE(SUM(bci.peso_kg * bci.quantity), 0))::NUMERIC as total_weight_rounded_kg,
  COUNT(DISTINCT bci.id)::INTEGER as items_count,
  COUNT(DISTINCT bc.id)::INTEGER as carts_with_variant,
  MAX(bc.updated_at) as last_updated
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bc.status = 'open'
GROUP BY 
  bci.product_id,
  p.nombre,
  bci.variant_id,
  pv.name,
  bci.peso_kg
ORDER BY product_name, variant_name;

COMMENT ON VIEW v_catalog_variant_weights IS 
  'Vista que muestra peso real (sin redondear) de cada variante en todos los carritos abiertos.';

---

-- ============================================================================
-- EJEMPLOS DE USO
-- ============================================================================

/*

-- EJEMPLO 1: Obtener peso real de un producto en el carrito
SELECT * FROM calculate_real_weight_by_product('product-uuid-here');

RESULTADO:
product_id                          | total_quantity | total_weight_kg | weight_rounded_kg | items_count
------------------------------------+----------------+-----------------+-------------------+-------------
550e8400-e29b-41d4-a716-446655440000|      10         |     2.5         |      3            |      2
-- Significa: 10 unidades en carrito, peso real 2.5kg (sin redondear), si se redondeara sería 3kg

---

-- EJEMPLO 2: Obtener peso real de una variante específica
SELECT * FROM calculate_real_weight_by_variant('product-id', 'variant-id');

RESULTADO:
product_id | variant_id | total_quantity | total_weight_kg | weight_rounded_kg | items_count
-----------+------------+----------------+-----------------+-------------------+-------------
550e8400...|550e8400....|     5          |     1.25        |      2            |      1

---

-- EJEMPLO 3: Obtener detalles completos
SELECT * FROM get_catalog_product_weight_details('product-uuid-here');

RESULTADO:
product_id | product_name | variant_id | variant_name | total_units_in_cart | weight_per_unit_kg | total_weight_kg | total_weight_rounded_kg | cost_per_unit | total_cost
-----------+--------------+------------+--------------+---------------------+--------------------+-----------------+-------------------------+---------------+----------
550e8400...|Tanga Encaje |550e8400....|Negro/M       |     5               |     0.25           |     1.25        |     2                   |    $3.94      |  $19.70

---

-- EJEMPLO 4: Ver todos los productos y sus pesos en carritos
SELECT * FROM v_catalog_product_weights;

RESULTADO:
product_id | product_name | items_in_carts | total_quantity | total_weight_real_kg | total_weight_rounded_kg | carts_with_product
-----------+--------------+----------------+----------------+----------------------+------------------------+--------------------
550e8400...|Tanga Encaje |      2          |     10         |     2.5              |     3                  |      5
550e8401...|Tank Top     |      1          |     3          |     0.75             |     1                  |      1

---

-- EJEMPLO 5: Ver pesos por variante
SELECT * FROM v_catalog_variant_weights
WHERE product_id = 'product-uuid-here';

*/

---

-- ============================================================================
-- INSTALACIÓN
-- ============================================================================

/*

PASO 1: Ejecutar este archivo en tu base de datos
psql -U postgres -d tu_base_de_datos -f FUNCION_CALCULAR_PESO_REAL_CATALOGO.sql

PASO 2: Verificar que las funciones están instaladas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'calculate_real_weight%' 
   OR routine_name LIKE 'get_catalog_product_weight%';

PASO 3: Usar en frontend (ejemplo TypeScript)

// Hook para obtener peso real de un producto
const { data: productWeight } = useQuery({
  queryKey: ['productWeight', productId],
  queryFn: async () => {
    const { data } = await supabase
      .rpc('calculate_real_weight_by_product', {
        p_product_id: productId
      });
    return data[0]; // Devuelve primer (único) resultado
  }
});

// Mostrar en UI
<div className="product-info">
  <p>Total en carrito: {productWeight?.total_quantity} unidades</p>
  <p>Peso real: {productWeight?.total_weight_kg} kg</p>
  <p>Peso redondeado: {productWeight?.weight_rounded_kg} kg (para cálculo de envío)</p>
</div>

*/
