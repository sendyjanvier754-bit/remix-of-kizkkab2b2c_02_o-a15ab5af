-- =====================================================
-- PASO 3: Recrear función con columna correcta
-- =====================================================
-- IMPORTANTE: Usa el nombre de columna que viste en PASO_1
-- Si es 'name' usa esta versión, si es 'nombre' cámbialo
-- =====================================================

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
  -- Obtener user_id del parámetro o del usuario autenticado
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Si no hay usuario, no retornar nada
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Validar permisos si se consulta otro usuario
  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
      RAISE EXCEPTION 'No tienes permiso para ver el inventario de otro usuario';
    END IF;
  END IF;
  
  -- Consulta principal
  RETURN QUERY
  SELECT 
    oi.id::UUID AS order_item_id,
    o.id::UUID AS order_id,
    o.order_number::TEXT,
    s.id::UUID AS seller_store_id,
    s.name::TEXT AS tienda_vendedor,  -- ✅ CAMBIA AQUÍ: usa 'name' o 'nombre' según PASO_1
    p.id::UUID AS product_id,
    p.nombre::TEXT AS producto_nombre,
    p.descripcion_corta::TEXT,
    p.imagen_principal::TEXT,
    COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]) AS galeria_imagenes,
    pv.id::UUID AS variant_id,
    COALESCE(pv.sku, oi.sku)::TEXT AS sku,
    pv.color::TEXT,
    pv.size::TEXT,
    pv.precio_original::NUMERIC,
    oi.cantidad::INTEGER AS stock,
    o.status::TEXT AS order_status,
    o.payment_status::TEXT,
    CASE 
      WHEN o.status = 'cancelled' THEN 'cancelled'
      WHEN o.status IN ('paid', 'placed') THEN 'pending'
      WHEN o.status IN ('delivered', 'completed') THEN 'available'
      ELSE 'pending'
    END::TEXT AS availability_status,
    o.payment_confirmed_at::TIMESTAMPTZ,
    o.created_at::TIMESTAMPTZ AS fecha_pedido,
    o.updated_at::TIMESTAMPTZ AS ultima_actualizacion
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
