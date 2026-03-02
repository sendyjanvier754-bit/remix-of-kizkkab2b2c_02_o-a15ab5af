-- =====================================================
-- REPARACIÓN: get_inventario_b2c
-- =====================================================
-- Este script borra y recrea todo desde cero
-- =====================================================

-- PASO 1: Eliminar función existente (si hay error)
DROP FUNCTION IF EXISTS get_inventario_b2c(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_inventario_b2c_resumen(UUID) CASCADE;

-- PASO 2: Eliminar tipo existente (si hay error)
DROP TYPE IF EXISTS inventario_b2c_item CASCADE;

-- PASO 3: Recrear tipo limpio
CREATE TYPE inventario_b2c_item AS (
  order_item_id UUID,
  order_id UUID,
  order_number TEXT,
  seller_store_id UUID,
  tienda_vendedor TEXT,
  product_id UUID,
  producto_nombre TEXT,
  descripcion_corta TEXT,
  imagen_principal TEXT,
  galeria_imagenes TEXT[],
  variant_id UUID,
  sku TEXT,
  color TEXT,
  size TEXT,
  precio_original NUMERIC,
  stock INTEGER,
  order_status TEXT,
  payment_status TEXT,
  availability_status TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  fecha_pedido TIMESTAMPTZ,
  ultima_actualizacion TIMESTAMPTZ
);

-- PASO 4: Recrear función principal
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
    s.nombre::TEXT,
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

-- PASO 5: Recrear función resumen
CREATE OR REPLACE FUNCTION get_inventario_b2c_resumen(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN '{"error": "No autenticado"}'::JSON;
  END IF;
  
  SELECT json_build_object(
    'total_productos', COUNT(DISTINCT product_id),
    'total_variantes', COUNT(DISTINCT variant_id),
    'total_unidades', SUM(stock)::INTEGER,
    'por_estado', (
      SELECT json_object_agg(availability_status, cantidad)
      FROM (
        SELECT 
          availability_status,
          COUNT(*) as cantidad
        FROM get_inventario_b2c(v_user_id)
        GROUP BY availability_status
      ) sub
    ),
    'valor_total', SUM(stock * COALESCE(precio_original, 0))::NUMERIC
  ) INTO v_result
  FROM get_inventario_b2c(v_user_id);
  
  RETURN v_result;
END;
$$;

-- PASO 6: Dar permisos
GRANT EXECUTE ON FUNCTION get_inventario_b2c TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventario_b2c TO anon;
GRANT EXECUTE ON FUNCTION get_inventario_b2c_resumen TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventario_b2c_resumen TO anon;

-- PASO 7: Comentarios
COMMENT ON FUNCTION get_inventario_b2c IS 'Inventario B2C del usuario autenticado';
COMMENT ON FUNCTION get_inventario_b2c_resumen IS 'Resumen del inventario B2C';

-- PASO 8: Verificación final
SELECT 
  '✅ VERIFICACIÓN FINAL' as resultado,
  proname as funcion,
  pg_get_function_arguments(p.oid) as parametros
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('get_inventario_b2c', 'get_inventario_b2c_resumen')
ORDER BY proname;

SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ REPARACIÓN COMPLETADA

Las funciones han sido recreadas desde cero.

🔄 SIGUIENTE PASO:
1. Recarga la página en el navegador (CTRL+R o F5)
2. Ve a /seller/inventario
3. El error 400 debería estar resuelto

🧪 PRUEBA MANUAL:
SELECT * FROM get_inventario_b2c() LIMIT 5;

' as mensaje;
