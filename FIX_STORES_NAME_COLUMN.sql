-- =====================================================
-- FIX FINAL: Corregir stores.nombre → stores.name
-- =====================================================

DROP FUNCTION IF EXISTS get_inventario_b2c(UUID, TEXT, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_inventario_b2c(
  p_user_id UUID DEFAULT NULL,
  p_availability_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS SETOF inventario_b2c_item
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
  SELECT 
    oi.id::UUID,
    o.id::UUID,
    SUBSTRING(o.id::TEXT FROM 1 FOR 8)::TEXT,
    s.id::UUID,
    s.name::TEXT,  -- ✅ FIX: stores.name en vez de stores.nombre
    p.id::UUID,
    p.nombre::TEXT,
    p.descripcion_corta::TEXT,
    p.imagen_principal::TEXT,
    COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]),
    pv.id::UUID,
    COALESCE(pv.sku, oi.sku)::TEXT,
    COALESCE(pv.attribute_combination->>'color', '')::TEXT,
    COALESCE(pv.attribute_combination->>'size', '')::TEXT,
    COALESCE(pv.price, oi.precio_unitario)::NUMERIC,
    oi.cantidad::INTEGER,
    o.status::TEXT,
    o.payment_status::TEXT,
    CASE 
      WHEN o.status = 'cancelled' THEN 'cancelled'
      WHEN o.status IN ('paid', 'placed', 'confirmed') THEN 'pending'
      WHEN o.status IN ('delivered', 'completed') THEN 'available'
      ELSE 'pending'
    END::TEXT,
    o.payment_confirmed_at::TIMESTAMPTZ,
    o.created_at::TIMESTAMPTZ,
    o.updated_at::TIMESTAMPTZ
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
  ORDER BY o.payment_confirmed_at DESC NULLS LAST, o.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_inventario_b2c TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventario_b2c TO anon;

SELECT '✅ CORRECCIÓN APLICADA: stores.name en vez de stores.nombre' as resultado;

-- Probar la función
SELECT 
  order_item_id,
  tienda_vendedor,
  producto_nombre,
  sku,
  color,
  size,
  stock
FROM get_inventario_b2c() 
LIMIT 3;
