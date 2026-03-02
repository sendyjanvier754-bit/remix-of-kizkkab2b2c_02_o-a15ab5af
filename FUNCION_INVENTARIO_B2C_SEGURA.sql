-- =====================================================
-- FUNCIÓN SEGURA: Inventario B2C
-- =====================================================
-- Ventajas sobre vista:
-- ✅ Seguridad incorporada (no depende de RLS heredado)
-- ✅ Puede recibir parámetros
-- ✅ Control total sobre qué datos retornar
-- =====================================================

-- Tipo de retorno para el inventario B2C
CREATE TYPE inventario_b2c_item AS (
  -- Identificadores
  order_item_id UUID,
  order_id UUID,
  order_number TEXT,
  
  -- Tienda vendedor (ex-comprador B2B)
  seller_store_id UUID,
  tienda_vendedor TEXT,
  
  -- Producto
  product_id UUID,
  producto_nombre TEXT,
  descripcion_corta TEXT,
  imagen_principal TEXT,
  galeria_imagenes TEXT[],
  
  -- Variante
  variant_id UUID,
  sku TEXT,
  color TEXT,
  size TEXT,
  precio_original NUMERIC,
  
  -- Stock/cantidad
  stock INTEGER,
  
  -- Estados
  order_status TEXT,
  payment_status TEXT,
  availability_status TEXT,
  
  -- Fechas
  payment_confirmed_at TIMESTAMPTZ,
  fecha_pedido TIMESTAMPTZ,
  ultima_actualizacion TIMESTAMPTZ
);

-- Función principal: Obtener inventario B2C del usuario actual
CREATE OR REPLACE FUNCTION get_inventario_b2c(
  p_user_id UUID DEFAULT NULL,  -- Si NULL, usa auth.uid()
  p_availability_status TEXT DEFAULT NULL,  -- Filtro opcional: 'available', 'pending', 'cancelled'
  p_limit INTEGER DEFAULT 100
)
RETURNS SETOF inventario_b2c_item
LANGUAGE plpgsql
SECURITY DEFINER  -- Se ejecuta con permisos del propietario de la función
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Obtener user_id (parámetro o usuario autenticado)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- ⚠️ SEGURIDAD: Si no hay usuario autenticado, no retornar nada
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- ⚠️ SEGURIDAD: Si se pasa p_user_id diferente al usuario actual,
  -- verificar que sea admin
  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes permiso para ver el inventario de otro usuario';
    END IF;
  END IF;
  
  -- Retornar inventario B2C del usuario
  RETURN QUERY
  SELECT 
    -- Identificadores
    oi.id::UUID as order_item_id,
    o.id::UUID as order_id,
    o.order_number::TEXT,
    
    -- Tienda vendedor
    s.id::UUID as seller_store_id,
    s.nombre::TEXT as tienda_vendedor,
    
    -- Producto
    p.id::UUID as product_id,
    p.nombre::TEXT as producto_nombre,
    p.descripcion_corta::TEXT,
    p.imagen_principal::TEXT,
    COALESCE(p.galeria_imagenes, ARRAY[p.imagen_principal]::text[]) as galeria_imagenes,
    
    -- Variante
    pv.id::UUID as variant_id,
    COALESCE(pv.sku, oi.sku)::TEXT as sku,
    pv.color::TEXT,
    pv.size::TEXT,
    pv.precio_original::NUMERIC as precio_original,
    
    -- Stock/cantidad
    oi.cantidad::INTEGER as stock,
    
    -- Estados
    o.status::TEXT as order_status,
    o.payment_status::TEXT,
    CASE 
      WHEN o.status = 'cancelled' THEN 'cancelled'
      WHEN o.status IN ('paid', 'placed') THEN 'pending'
      WHEN o.status IN ('delivered', 'completed') THEN 'available'
      ELSE 'pending'
    END::TEXT as availability_status,
    
    -- Fechas
    o.payment_confirmed_at::TIMESTAMPTZ,
    o.created_at::TIMESTAMPTZ as fecha_pedido,
    o.updated_at::TIMESTAMPTZ as ultima_actualizacion
    
  FROM order_items_b2b oi
  INNER JOIN orders_b2b o ON o.id = oi.order_id
  INNER JOIN products p ON p.id = oi.product_id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  INNER JOIN stores s ON s.owner_user_id = o.buyer_id
  
  WHERE 
    -- ⚠️ SEGURIDAD: Solo pedidos del usuario actual (ex-comprador)
    o.buyer_id = v_user_id
    
    -- Solo pedidos válidos para reventa
    AND o.status IN ('paid', 'placed', 'delivered', 'completed')
    AND o.status != 'cancelled'
    AND oi.variant_id IS NOT NULL
    
    -- Filtro opcional por availability_status
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

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_inventario_b2c TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_inventario_b2c IS 
'Retorna el inventario B2C del usuario autenticado (productos de pedidos B2B pagados).
SEGURIDAD: Incorporada en la función - solo retorna pedidos del usuario actual.
USO: SELECT * FROM get_inventario_b2c()';

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función: Obtener resumen de inventario
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

GRANT EXECUTE ON FUNCTION get_inventario_b2c_resumen TO authenticated;

-- =====================================================
-- EJEMPLOS DE USO
-- =====================================================

SELECT '
✅ FUNCIONES CREADAS

📋 FUNCIONES DISPONIBLES:

1️⃣ get_inventario_b2c()
   Retorna todos los productos en inventario B2C del usuario actual
   
   USO BÁSICO:
   SELECT * FROM get_inventario_b2c();
   
   CON FILTROS:
   SELECT * FROM get_inventario_b2c(
     p_user_id := auth.uid(),
     p_availability_status := ''available'',  -- Solo productos disponibles
     p_limit := 50
   );
   
2️⃣ get_inventario_b2c_resumen()
   Retorna resumen JSON con estadísticas
   
   USO:
   SELECT get_inventario_b2c_resumen();
   
   RESULTADO:
   {
     "total_productos": 10,
     "total_variantes": 15,
     "total_unidades": 150,
     "por_estado": {"available": 12, "pending": 3},
     "valor_total": 4500.00
   }

🔒 SEGURIDAD:
- Solo retorna pedidos del usuario autenticado (auth.uid())
- No depende de RLS de tablas base
- Seguridad incorporada en la función
- Admins pueden ver inventario de otros usuarios

🎯 USO EN FRONTEND (Supabase):
const { data, error } = await supabase.rpc(''get_inventario_b2c'', {
  p_availability_status: ''available'',
  p_limit: 100
});

💡 VENTAJAS VS VISTA:
✅ Seguridad explícita (no depende de RLS heredado)
✅ Puede recibir parámetros (filtros, límites)
✅ Puede validar permisos internamente
✅ Retorna tipo personalizado (mejor tipado)
✅ Más fácil de mantener y entender

' as resultado;

-- Prueba rápida
SELECT 
  'PRUEBA: Tu inventario B2C' as titulo,
  producto_nombre,
  sku,
  color,
  size,
  stock,
  availability_status,
  order_status
FROM get_inventario_b2c()
LIMIT 5;

SELECT 
  'PRUEBA: Resumen de inventario' as titulo,
  get_inventario_b2c_resumen() as resumen;
