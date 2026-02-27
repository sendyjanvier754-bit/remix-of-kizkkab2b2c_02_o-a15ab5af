-- ============================================================================
-- 🔍 VER EMAILS DE BUYERS Y SELLERS
-- ============================================================================

-- PASO 1: Ver TU email actual
SELECT 
  '🙋 MI USUARIO ACTUAL' AS tipo,
  auth.uid() AS user_id,
  u.email AS email
FROM auth.users u
WHERE u.id = auth.uid();

-- ============================================================================
-- PASO 2: Ver emails de TODOS los buyer_id en pedidos
-- ============================================================================

SELECT 
  '👤 BUYERS EN PEDIDOS' AS tipo,
  o.buyer_id,
  u.email AS buyer_email,
  COUNT(DISTINCT o.id) AS total_pedidos,
  SUM(o.total_amount) AS total_usd
FROM orders_b2b o
LEFT JOIN auth.users u ON u.id = o.buyer_id
WHERE o.created_at > NOW() - INTERVAL '30 days'
GROUP BY o.buyer_id, u.email
ORDER BY total_pedidos DESC;

-- ============================================================================
-- PASO 3: Ver emails de TODOS los seller_id en pedidos
-- ============================================================================

SELECT 
  '🏪 SELLERS EN PEDIDOS' AS tipo,
  o.seller_id,
  u.email AS seller_email,
  COUNT(DISTINCT o.id) AS total_pedidos,
  SUM(o.total_amount) AS total_usd
FROM orders_b2b o
LEFT JOIN auth.users u ON u.id = o.seller_id
WHERE o.created_at > NOW() - INTERVAL '30 days'
GROUP BY o.seller_id, u.email
ORDER BY total_pedidos DESC;

-- ============================================================================
-- PASO 4: Detalle de pedidos con emails
-- ============================================================================

SELECT 
  '📦 DETALLE PEDIDOS' AS tipo,
  o.id,
  o.created_at,
  o.status,
  o.total_amount,
  buyer_u.email AS buyer_email,
  seller_u.email AS seller_email,
  COUNT(oi.id) AS items,
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ SOY BUYER'
    WHEN o.seller_id = auth.uid() THEN '✅ SOY SELLER'
    WHEN buyer_u.email = (SELECT email FROM auth.users WHERE id = auth.uid()) THEN '⚠️ MISMO EMAIL (buyer) PERO DIFERENTE UUID'
    WHEN seller_u.email = (SELECT email FROM auth.users WHERE id = auth.uid()) THEN '⚠️ MISMO EMAIL (seller) PERO DIFERENTE UUID'
    ELSE '❌ NO SOY YO'
  END AS relacion
FROM orders_b2b o
LEFT JOIN auth.users buyer_u ON buyer_u.id = o.buyer_id
LEFT JOIN auth.users seller_u ON seller_u.id = o.seller_id
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.created_at, o.status, o.total_amount, buyer_u.email, seller_u.email
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 5: Comparar UUIDs y emails
-- ============================================================================

SELECT 
  '🔑 COMPARACIÓN' AS tipo,
  'Mi cuenta actual' AS descripcion,
  auth.uid() AS uuid,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS email
UNION ALL
SELECT 
  '🔑 COMPARACIÓN' AS tipo,
  'Cuenta de los pedidos' AS descripcion,
  o.buyer_id AS uuid,
  u.email AS email
FROM orders_b2b o
LEFT JOIN auth.users u ON u.id = o.buyer_id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.buyer_id, u.email
LIMIT 5;

-- ============================================================================
-- 📋 INSTRUCCIONES
-- ============================================================================
/*
EJECUTA ESTO EN SUPABASE SQL EDITOR

INTERPRETACIÓN:

PASO 1: Tu email actual
  → Este es el email con el que estás logueado AHORA

PASO 2: Emails de buyers
  → Estos son los emails de los "compradores" en los pedidos
  
PASO 3: Emails de sellers  
  → Estos son los emails de los "vendedores" en los pedidos

PASO 4: Detalle con relación
  → Si ves "⚠️ MISMO EMAIL PERO DIFERENTE UUID":
    - Es TU email pero con diferente UUID
    - Significa que recreaste la cuenta o hay duplicado
    - Necesitas TRANSFERIR los pedidos al UUID actual

PASO 5: Comparación directa
  → Compara lado a lado tu UUID actual vs UUID de los pedidos
  → Si el EMAIL es el mismo pero UUID diferente: TRANSFERENCIA necesaria

============================================================================
🎯 PRÓXIMA ACCIÓN SEGÚN RESULTADO
============================================================================

CASO A: Email es el mismo pero UUID diferente
  → Ejecutar script de transferencia:
    UPDATE orders_b2b 
    SET buyer_id = 'TU_UUID_ACTUAL',
        seller_id = 'TU_UUID_ACTUAL'
    WHERE buyer_id = 'UUID_ANTIGUO';

CASO B: Email es completamente diferente
  → Los pedidos son de otra cuenta
  → Verificar si debes loguearte con esa cuenta
  → O si son pedidos que no te pertenecen

CASO C: No hay match de email
  → El buyer_id no existe en auth.users
  → Datos corruptos o cuenta eliminada
  → Contactar soporte

============================================================================
*/
