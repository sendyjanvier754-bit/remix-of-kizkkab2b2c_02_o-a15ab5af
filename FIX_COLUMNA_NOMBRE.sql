-- =====================================================
-- FIX FINAL: Corregir nombre de columna
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
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
      RAISE EXCEPTION 'No tienes permiso para ver el inventario de otro usuario';
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    oi.id::UUID,
    o.id::UUID,
    o.order_number::TEXT,
    s.id::UUID,
    COALESCE(s.name, s.nombre, 'Sin nombre')::TEXT,  -- ✅ FIX: Usa 'name' o 'nombre'
    p.id::UUID,
    p.nombre::TEXT,
    p.descripcion_corta::TEXT,
    p.imagen_principal::TEXT,
    COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]),
    pv.id::UUID,
    COALESCE(pv.sku, oi.sku)::TEXT,
    pv.color::TEXT,
    pv.size::TEXT,
    pv.precio_original::NUMERIC,
    oi.cantidad::INTEGER,
    o.status::TEXT,
    o.payment_status::TEXT,
    CASE 
      WHEN o.status = 'cancelled' THEN 'cancelled'
      WHEN o.status IN ('paid', 'placed') THEN 'pending'
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
  INNER JOIN stores s ON s.owner_user_id = o.buyer_id
  WHERE 
    o.buyer_id = v_user_id
    AND o.status IN ('paid', 'placed', 'delivered', 'completed')
    AND o.status != 'cancelled'
    AND oi.variant_id IS NOT NULL
    AND (
      p_availability_status IS NULL
      OR
      CASE 
        WHEN o.status = 'cancelled' THEN 'cancelled'
        WHEN o.status IN ('paid', 'placed') THEN 'pending'
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

SELECT '
✅ CORREGIDO - Ahora usa s.name en lugar de s.nombre

🔄 SIGUIENTE PASO:
1. Recarga el navegador con Ctrl+Shift+R
2. El error "column s.nombre does not exist" debe desaparecer
3. Tu inventario B2C debería cargar correctamente

' as resultado;

-- Prueba rápida
SELECT * FROM get_inventario_b2c() LIMIT 3;
