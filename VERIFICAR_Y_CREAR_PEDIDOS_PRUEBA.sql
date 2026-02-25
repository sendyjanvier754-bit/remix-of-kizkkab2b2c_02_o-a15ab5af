-- ============================================================================
-- VERIFICAR USUARIOS CON PEDIDOS Y CREAR PEDIDOS DE PRUEBA
-- ============================================================================

-- ============================================================================
-- 1. VER QUIÉNES TIENEN PEDIDOS ACTUALMENTE
-- ============================================================================

SELECT 
  o.seller_id,
  p.email as seller_email,
  p.full_name as seller_name,
  COUNT(o.id) as total_pedidos,
  SUM(o.total_amount) as total_ventas
FROM public.orders_b2b o
LEFT JOIN public.profiles p ON o.seller_id = p.id
GROUP BY o.seller_id, p.email, p.full_name
ORDER BY total_pedidos DESC;

-- ============================================================================
-- 2. VER MI USUARIO ACTUAL
-- ============================================================================

SELECT 
  auth.uid() as mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email,
  (SELECT full_name FROM public.profiles WHERE id = auth.uid()) as mi_nombre;

-- ============================================================================
-- 3. OPCIÓN A: ASIGNAR PEDIDOS EXISTENTES AL USUARIO ACTUAL
-- ============================================================================
-- CUIDADO: Esto cambiará el seller_id de pedidos existentes
-- Solo ejecuta esto si quieres transferir pedidos para pruebas

-- Comentado por seguridad - descomenta si quieres usarlo:
/*
UPDATE public.orders_b2b
SET seller_id = auth.uid(),
    updated_at = now()
WHERE id IN (
  SELECT id FROM public.orders_b2b
  ORDER BY created_at DESC
  LIMIT 5  -- Asignar los últimos 5 pedidos al usuario actual
);
*/

-- ============================================================================
-- 4. OPCIÓN B: CREAR PEDIDOS DE PRUEBA PARA EL USUARIO ACTUAL
-- ============================================================================

-- Primero, verificar que tengas productos en tu catálogo
SELECT 
  COUNT(*) as total_productos,
  COUNT(DISTINCT store_id) as total_stores
FROM public.products
WHERE store_id IN (
  SELECT id FROM public.stores WHERE owner_user_id = auth.uid()
);

-- Si tienes productos, crear pedido de prueba:
-- (Ejecuta en bloques separados)

-- PASO 4.1: Crear el pedido
INSERT INTO public.orders_b2b (
  seller_id,
  buyer_id,
  order_number,
  status,
  payment_status,
  payment_method,
  total_quantity,
  subtotal,
  shipping_cost,
  discount_amount,
  tax_amount,
  total_amount,
  currency,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT 
  auth.uid() as seller_id,
  auth.uid() as buyer_id,
  'TEST-' || TO_CHAR(now(), 'YYYYMMDD-') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') as order_number,
  'pending' as status,
  'pending' as payment_status,
  'cash' as payment_method,
  5 as total_quantity,
  100.00 as subtotal,
  10.00 as shipping_cost,
  0.00 as discount_amount,
  0.00 as tax_amount,
  110.00 as total_amount,
  'USD' as currency,
  'Pedido de prueba - Testing' as notes,
  '{"test": true, "created_by": "script"}'::jsonb as metadata,
  now() as created_at,
  now() as updated_at
RETURNING id, order_number, total_amount, status;

-- PASO 4.2: Obtener el ID del pedido recién creado
-- (Guarda este ID para el siguiente paso)
SELECT 
  id,
  order_number,
  seller_id,
  buyer_id,
  status,
  total_amount
FROM public.orders_b2b
WHERE seller_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- PASO 4.3: Crear items del pedido
-- REEMPLAZA 'PASTE_ORDER_ID_HERE' con el ID del pedido del paso anterior
/*
INSERT INTO public.order_items_b2b (
  order_id,
  product_id,
  sku,
  nombre,
  cantidad,
  precio_unitario,
  precio_total,
  color,
  size,
  metadata
)
VALUES
  (
    'PASTE_ORDER_ID_HERE'::uuid,  -- Reemplaza con el ID real
    NULL,
    'TEST-SKU-001',
    'Producto de Prueba 1',
    2,
    25.00,
    50.00,
    'Rojo',
    'M',
    '{"test": true}'::jsonb
  ),
  (
    'PASTE_ORDER_ID_HERE'::uuid,  -- Reemplaza con el ID real
    NULL,
    'TEST-SKU-002',
    'Producto de Prueba 2',
    3,
    20.00,
    60.00,
    'Azul',
    'L',
    '{"test": true}'::jsonb
  );
*/

-- ============================================================================
-- 5. OPCIÓN C: CREAR VARIOS PEDIDOS DE PRUEBA CON DIFERENTES ESTADOS
-- ============================================================================

-- Crear pedido PENDIENTE
INSERT INTO public.orders_b2b (
  seller_id, buyer_id, order_number, status, payment_status,
  payment_method, total_quantity, total_amount, currency, notes
)
VALUES (
  auth.uid(), auth.uid(),
  'TEST-PEND-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  'pending', 'pending',
  'cash', 3, 75.00, 'USD', 'Pedido PENDIENTE de prueba'
);

-- Crear pedido PAGADO
INSERT INTO public.orders_b2b (
  seller_id, buyer_id, order_number, status, payment_status,
  payment_method, total_quantity, total_amount, currency, notes
)
VALUES (
  auth.uid(), auth.uid(),
  'TEST-PAID-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  'paid', 'paid',
  'credit_card', 5, 125.00, 'USD', 'Pedido PAGADO de prueba'
);

-- Crear pedido EN CAMINO
INSERT INTO public.orders_b2b (
  seller_id, buyer_id, order_number, status, payment_status,
  payment_method, total_quantity, total_amount, currency, notes,
  metadata
)
VALUES (
  auth.uid(), auth.uid(),
  'TEST-SHIP-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  'shipped', 'paid',
  'credit_card', 8, 200.00, 'USD', 'Pedido ENVIADO de prueba',
  '{"carrier": "DHL", "tracking_number": "TEST123456"}'::jsonb
);

-- Crear pedido ENTREGADO
INSERT INTO public.orders_b2b (
  seller_id, buyer_id, order_number, status, payment_status,
  payment_method, total_quantity, total_amount, currency, notes
)
VALUES (
  auth.uid(), auth.uid(),
  'TEST-DEL-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  'delivered', 'paid',
  'paypal', 10, 300.00, 'USD', 'Pedido ENTREGADO de prueba'
);

-- ============================================================================
-- 6. VERIFICAR PEDIDOS CREADOS
-- ============================================================================

SELECT 
  id,
  order_number,
  status,
  payment_status,
  total_amount,
  currency,
  notes,
  created_at
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 7. CONTAR MIS PEDIDOS POR ESTADO
-- ============================================================================

SELECT 
  status,
  payment_status,
  COUNT(*) as cantidad,
  SUM(total_amount) as total
FROM public.orders_b2b
WHERE seller_id = auth.uid() OR buyer_id = auth.uid()
GROUP BY status, payment_status
ORDER BY status, payment_status;

-- ============================================================================
-- INSTRUCCIONES:
-- ============================================================================
-- 1. Ejecuta el paso 1 para ver quién tiene pedidos
-- 2. Ejecuta el paso 2 para ver tu usuario actual
-- 3. ELIGE UNA OPCIÓN:
--    - OPCIÓN A: Asignar pedidos existentes (descomenta el UPDATE)
--    - OPCIÓN B: Crear 1 pedido con items detallados (pasos 4.1, 4.2, 4.3)
--    - OPCIÓN C: Crear varios pedidos rápido (ejecuta todo el paso 5)
-- 4. Ejecuta paso 6 y 7 para verificar
-- 5. Recarga la página del navegador (F5)
-- ============================================================================
