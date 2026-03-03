-- =====================================================
-- FIX: MIN/MAX con UUIDs requiere CAST a TEXT primero
-- =====================================================

DROP FUNCTION IF EXISTS get_inventario_b2c_agrupado(UUID, TEXT, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_inventario_b2c_agrupado(
  p_user_id UUID DEFAULT NULL,
  p_availability_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS SETOF inventario_b2c_producto_agrupado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'No tienes permiso para ver el inventario de otro usuario';
    END IF;
  END IF;
  
  RETURN QUERY
  WITH variantes_agrupadas AS (
    SELECT 
      p.id AS product_id,
      p.nombre AS producto_nombre,
      p.descripcion_corta,
      p.imagen_principal,
      COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]) AS galeria_imagenes,
      MIN(o.id::TEXT)::UUID AS order_id,  -- ✅ Cast a TEXT primero, luego a UUID
      SUBSTRING(MIN(o.id::TEXT) FROM 1 FOR 8) AS order_number,
      MIN(s.id::TEXT)::UUID AS seller_store_id,  -- ✅ Cast a TEXT primero, luego a UUID
      MAX(s.name) AS tienda_vendedor,
      SUM(oi.cantidad) AS total_stock,
      AVG(COALESCE(pv.price, oi.precio_unitario)) AS precio_promedio,
      MAX(
        CASE 
          WHEN o.status = 'cancelled' THEN 'cancelled'
          WHEN o.status IN ('paid', 'placed', 'confirmed') THEN 'pending'
          WHEN o.status IN ('delivered', 'completed') THEN 'available'
          ELSE 'pending'
        END
      ) AS availability_status,
      MAX(o.payment_confirmed_at) AS payment_confirmed_at,
      MAX(o.created_at) AS fecha_pedido,
      MAX(o.updated_at) AS ultima_actualizacion,
      jsonb_agg(
        jsonb_build_object(
          'order_item_id', oi.id,
          'variant_id', pv.id,
          'sku', COALESCE(pv.sku, oi.sku),
          'color', COALESCE(pv.attribute_combination->>'color', ''),
          'size', COALESCE(pv.attribute_combination->>'size', ''),
          'stock', oi.cantidad,
          'precio_original', COALESCE(pv.price, oi.precio_unitario)
        ) ORDER BY COALESCE(pv.attribute_combination->>'size', oi.sku)
      ) AS variantes
    FROM order_items_b2b oi
    INNER JOIN orders_b2b o ON o.id = oi.order_id
    INNER JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    LEFT JOIN stores s ON s.owner_user_id = o.buyer_id
    WHERE 
      o.buyer_id = v_user_id
      AND o.payment_status = 'paid'
      AND o.status NOT IN ('cancelled', 'draft')
      AND (
        p_availability_status IS NULL
        OR
        CASE 
          WHEN o.status = 'cancelled' THEN 'cancelled'
          WHEN o.status IN ('paid', 'placed', 'confirmed') THEN 'pending'
          WHEN o.status IN ('delivered', 'completed') THEN 'available'
          ELSE 'pending'
        END = p_availability_status
      )
    GROUP BY p.id, p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes
    ORDER BY MAX(o.payment_confirmed_at) DESC NULLS LAST, MAX(o.created_at) DESC
    LIMIT p_limit
  )
  SELECT 
    product_id::UUID,
    producto_nombre::TEXT,
    descripcion_corta::TEXT,
    imagen_principal::TEXT,
    galeria_imagenes::TEXT[],
    order_id::UUID,
    order_number::TEXT,
    seller_store_id::UUID,
    tienda_vendedor::TEXT,
    total_stock::INTEGER,
    ROUND(precio_promedio, 2)::NUMERIC,
    availability_status::TEXT,
    payment_confirmed_at::TIMESTAMPTZ,
    fecha_pedido::TIMESTAMPTZ,
    ultima_actualizacion::TIMESTAMPTZ,
    variantes::JSONB
  FROM variantes_agrupadas;
END;
$$;

GRANT EXECUTE ON FUNCTION get_inventario_b2c_agrupado TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventario_b2c_agrupado TO anon;

SELECT '✅ FUNCIÓN CORREGIDA: UUID → TEXT → MIN() → UUID' as resultado;

-- Verificar que funciona
SELECT 
  product_id,
  producto_nombre,
  total_stock,
  jsonb_array_length(variantes) as num_variantes,
  order_id,
  order_number
FROM get_inventario_b2c_agrupado() 
LIMIT 3;
