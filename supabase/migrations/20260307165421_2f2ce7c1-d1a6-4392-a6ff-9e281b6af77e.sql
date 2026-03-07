-- Fix: Use oi.precio_unitario (actual checkout price) instead of pv.price (base factory price)
CREATE OR REPLACE FUNCTION public.get_inventario_b2c_agrupado(
  p_user_id uuid DEFAULT NULL::uuid,
  p_availability_status text DEFAULT NULL::text,
  p_limit integer DEFAULT 100
)
RETURNS SETOF inventario_b2c_producto_agrupado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      MIN(o.id::TEXT)::UUID AS order_id,
      SUBSTRING(MIN(o.id::TEXT) FROM 1 FOR 8) AS order_number,
      MIN(s.id::TEXT)::UUID AS seller_store_id,
      MAX(s.name) AS tienda_vendedor,
      SUM(oi.cantidad) AS total_stock,
      -- Use oi.precio_unitario: the actual price paid at checkout (landed price)
      AVG(oi.precio_unitario) AS precio_promedio,
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
      p.categoria_id,
      jsonb_agg(
        jsonb_build_object(
          'order_item_id', oi.id,
          'variant_id', pv.id,
          'sku', COALESCE(pv.sku, oi.sku),
          'color', COALESCE(pv.attribute_combination->>'color', ''),
          'size', COALESCE(pv.attribute_combination->>'size', ''),
          'stock', oi.cantidad,
          'precio_original', oi.precio_unitario  -- Actual checkout price
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
    GROUP BY p.id, p.nombre, p.descripcion_corta, p.imagen_principal, p.galeria_imagenes, p.categoria_id
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
    variantes::JSONB,
    categoria_id::UUID
  FROM variantes_agrupadas;
END;
$function$;