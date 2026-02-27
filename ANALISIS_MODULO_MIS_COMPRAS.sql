-- ============================================================================
-- ANÁLISIS COMPLETO: MÓDULO "MIS COMPRAS" - CÓMO BUSCA LOS PEDIDOS
-- ============================================================================
-- Este documento explica exactamente cómo funciona el módulo "Mis Compras"
-- ============================================================================

-- ============================================================================
-- 🎯 PÁGINA: SellerMisComprasPage.tsx
-- ============================================================================
-- Ruta: /seller/mis-compras
-- Archivo: src/pages/seller/SellerMisComprasPage.tsx

-- LÍNEA 13 del archivo:
-- import { useBuyerB2BOrders } from '@/hooks/useBuyerOrders';

-- LÍNEA 102 del archivo:
-- const { data: orders, isLoading } = useBuyerB2BOrders(statusFilter === 'all' ? undefined : statusFilter);

-- ============================================================================
-- 📦 HOOK PRINCIPAL: useBuyerB2BOrders()
-- ============================================================================
-- Archivo: src/hooks/useBuyerOrders.ts
-- Líneas: 112-180

-- FUNCIÓN COMPLETA (TypeScript):
/*
export const useBuyerB2BOrders = (statusFilter?: BuyerOrderStatus | 'all') => {
  const { user } = useAuth();  // 1️⃣ Obtiene el usuario actual

  return useQuery({
    queryKey: ['buyer-b2b-orders', user?.id, statusFilter],  // 2️⃣ Cache key
    queryFn: async () => {
      if (!user?.id) return [];  // 3️⃣ Si no hay usuario, retorna vacío

      // 4️⃣ QUERY PRINCIPAL - AQUÍ ESTÁ LA BÚSQUEDA:
      const { data, error } = await supabase
        .from('orders_b2b')                    // 📊 TABLA: orders_b2b
        .select(`
          *,
          order_items_b2b (*, products:product_id(imagen_principal)),
          seller_profile:profiles!orders_b2b_seller_id_fkey (full_name, email)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)  // 🔑 FILTRO CLAVE
        .neq('status', 'draft')              // 🚫 Excluye borradores
        .order('created_at', { ascending: false });  // 📅 Orden: más recientes primero

      if (error) throw error;

      // ... resto del código (mapping de imágenes, etc)
      
      return data;
    },
    enabled: !!user?.id,  // 5️⃣ Solo ejecuta si hay usuario
  });
};
*/

-- ============================================================================
-- 🔍 EXPLICACIÓN DETALLADA DE LA QUERY
-- ============================================================================

-- 1️⃣ USUARIO ACTUAL:
--    - Obtiene el user.id del usuario autenticado (auth.uid())
--    - Este es el UUID del usuario que inició sesión

-- 2️⃣ TABLA PRINCIPAL:
--    - orders_b2b: Tabla de pedidos B2B

-- 3️⃣ JOINS (SELECT):
--    - order_items_b2b: Items del pedido
--    - products: Información del producto (imagen principal)
--    - profiles: Perfil del vendedor (nombre, email)

-- 4️⃣ FILTRO PRINCIPAL (.or):
--    buyer_id.eq.${user.id}  OR  seller_id.eq.${user.id}
--    
--    Esto significa:
--    - Busca pedidos donde YO soy el BUYER (comprador) 
--    O
--    - Busca pedidos donde YO soy el SELLER (vendedor comprando mayorista)

-- 5️⃣ FILTROS ADICIONALES:
--    - .neq('status', 'draft'): NO muestra borradores
--    - .order('created_at', { ascending: false }): Más recientes primero

-- ============================================================================
-- 🗄️ QUERY SQL EQUIVALENTE (LO QUE REALMENTE SE EJECUTA)
-- ============================================================================

-- Con RLS (Row Level Security) aplicado:
SELECT 
  o.*,
  -- Items del pedido
  (SELECT json_agg(
    json_build_object(
      'id', oi.id,
      'order_id', oi.order_id,
      'product_id', oi.product_id,
      'sku', oi.sku,
      'nombre', oi.nombre,
      'cantidad', oi.cantidad,
      'precio_unitario', oi.precio_unitario,
      'subtotal', oi.precio_total,
      'image', p.imagen_principal
    )
  )
  FROM order_items_b2b oi
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = o.id
  ) as order_items_b2b,
  
  -- Perfil del vendedor
  json_build_object(
    'full_name', seller.full_name,
    'email', seller.email
  ) as seller_profile

FROM public.orders_b2b o
LEFT JOIN public.profiles seller ON o.seller_id = seller.id

WHERE 
  -- FILTRO PRINCIPAL: Soy buyer O seller
  (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  AND o.status != 'draft'
  
  -- RLS automáticamente aplica estas políticas:
  -- - orders_b2b_select_seller: permite ver si seller_id = auth.uid() OR buyer_id = auth.uid()
  -- - orders_b2b_all_admin: permite ver todos si is_admin(auth.uid())

ORDER BY o.created_at DESC;

-- ============================================================================
-- 🔐 POLÍTICAS RLS QUE AFECTAN LA QUERY
-- ============================================================================

-- Política 1: orders_b2b_select_seller
CREATE POLICY "orders_b2b_select_seller" ON public.orders_b2b
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);

-- Política 2: orders_b2b_all_admin (si eres admin)
CREATE POLICY "orders_b2b_all_admin" ON public.orders_b2b
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
);

-- Política 3: order_items_b2b_select_seller
CREATE POLICY "order_items_b2b_select_seller" ON public.order_items_b2b
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders_b2b
    WHERE orders_b2b.id = order_items_b2b.order_id
    AND (orders_b2b.seller_id = auth.uid() OR orders_b2b.buyer_id = auth.uid())
  )
);

-- ============================================================================
-- 🎭 EJEMPLO PRÁCTICO
-- ============================================================================

-- Usuario actual:
--   UUID: 7c635c9b-9971-4b3f-8fc4-b75436b33174
--   Email: usuario@ejemplo.com

-- Query que se ejecuta:
SELECT * 
FROM public.orders_b2b
WHERE 
  (buyer_id = '7c635c9b-9971-4b3f-8fc4-b75436b33174' 
   OR 
   seller_id = '7c635c9b-9971-4b3f-8fc4-b75436b33174')
  AND status != 'draft'
ORDER BY created_at DESC;

-- ============================================================================
-- ❓ POR QUÉ NO APARECEN LOS PEDIDOS
-- ============================================================================

-- 1. buyer_id es NULL:
--    → El pedido no tiene buyer_id asignado
--    → Solución: Ejecutar TRANSFERIR_PEDIDOS_OTRA_CUENTA.sql

-- 2. buyer_id es de OTRO usuario:
--    → El pedido pertenece a otra cuenta
--    → Causa: Cambiaste de cuenta o usaste otra sesión
--    → Solución: Transferir el pedido a tu usuario actual

-- 3. seller_id es de OTRO usuario y buyer_id es NULL:
--    → El pedido no está vinculado a ti de ninguna forma
--    → Solución: Asignar buyer_id a tu usuario

-- 4. Las políticas RLS bloquean el acceso:
--    → RLS está mal configurado
--    → Solución: Ejecutar FIX_ORDERS_RLS_COMPLETE.sql

-- 5. El pedido tiene status = 'draft':
--    → Los borradores no se muestran
--    → Solución: Cambiar status a 'placed', 'paid', etc.

-- ============================================================================
-- 🧪 QUERY DE DIAGNÓSTICO
-- ============================================================================

-- Ver MIS pedidos (lo que DEBERÍA aparecer en "Mis Compras"):
SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at,
  CASE 
    WHEN buyer_id = auth.uid() THEN '✅ Soy BUYER'
    WHEN seller_id = auth.uid() THEN '✅ Soy SELLER'
    ELSE '❌ NO SOY NINGUNO'
  END as mi_relacion,
  CASE
    WHEN status = 'draft' THEN '🚫 BORRADOR (no se muestra)'
    ELSE '✅ SE DEBE MOSTRAR'
  END as debe_mostrarse
FROM public.orders_b2b
WHERE 
  (buyer_id = auth.uid() OR seller_id = auth.uid())
ORDER BY created_at DESC
LIMIT 20;

-- Ver pedidos que NO veo pero existen:
SELECT 
  id,
  seller_id,
  buyer_id,
  status,
  payment_status,
  total_amount,
  created_at,
  CASE 
    WHEN buyer_id IS NULL THEN '❌ Sin buyer_id'
    WHEN seller_id IS NULL THEN '❌ Sin seller_id'
    ELSE '✅ Tiene ambos IDs'
  END as problema
FROM public.orders_b2b
WHERE 
  (buyer_id != auth.uid() AND seller_id != auth.uid())
  OR buyer_id IS NULL
  OR seller_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 📊 RESUMEN DEL FLUJO COMPLETO
-- ============================================================================

-- 1. Usuario abre /seller/mis-compras
-- 2. SellerMisComprasPage.tsx llama a useBuyerB2BOrders()
-- 3. useBuyerB2BOrders() ejecuta query en orders_b2b
-- 4. Supabase aplica políticas RLS automáticamente
-- 5. Query busca: buyer_id = user.id OR seller_id = user.id
-- 6. Query excluye: status = 'draft'
-- 7. Query ordena por: created_at DESC
-- 8. Retorna pedidos con items y seller\_profile
-- 9. SellerMisComprasPage.tsx renderiza los pedidos

-- ============================================================================
-- ✅ SOLUCIÓN SI NO APARECEN PEDIDOS
-- ============================================================================

-- PASO 1: Verificar si tienes pedidos asignados
SELECT COUNT(*) as mis_pedidos
FROM public.orders_b2b
WHERE (buyer_id = auth.uid() OR seller_id = auth.uid())
AND status != 'draft';

-- PASO 2: Si COUNT = 0, verificar pedidos sin asignar
SELECT COUNT(*) as pedidos_sin_asignar
FROM public.orders_b2b
WHERE buyer_id IS NULL AND created_at > NOW() - INTERVAL '30 days';

-- PASO 3: Si hay pedidos sin asignar, ejecutar:
-- UPDATE public.orders_b2b
-- SET buyer_id = auth.uid(), updated_at = NOW()
-- WHERE buyer_id IS NULL AND created_at > NOW() - INTERVAL '30 days';

-- PASO 4: Recargar la página en el navegador

-- ============================================================================
