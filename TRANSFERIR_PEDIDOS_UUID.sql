-- ============================================================================
-- 🔄 SCRIPT DE TRANSFERENCIA DE PEDIDOS
-- ============================================================================
-- USA ESTO SI EL DIAGNÓSTICO MOSTRÓ QUE EL EMAIL ES EL MISMO PERO UUID DIFERENTE

-- ============================================================================
-- ⚠️ IMPORTANTE: LEE ANTES DE EJECUTAR
-- ============================================================================
/*
Este script TRANSFIERE pedidos de un UUID antiguo a tu UUID actual.

SOLO ejecuta esto si:
1. El diagnóstico mostró que el email es el MISMO
2. Pero el UUID es DIFERENTE
3. Los pedidos son TUYOS pero con UUID antiguo

NO ejecutes si:
- Los pedidos son de otra persona
- No estás seguro de que son tuyos
*/

-- ============================================================================
-- PASO 1: VERIFICAR QUÉ SE VA A TRANSFERIR
-- ============================================================================

-- MOSTRAR: Tu UUID actual
SELECT 
  'Tu UUID actual' AS info,
  auth.uid() AS uuid_actual,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS email_actual;

-- MOSTRAR: UUID antiguo de los pedidos
SELECT 
  'UUID en pedidos (antiguo)' AS info,
  o.buyer_id AS uuid_antiguo,
  u.email AS email_antiguo,
  COUNT(*) AS total_pedidos,
  SUM(o.total_amount) AS total_usd
FROM orders_b2b o
LEFT JOIN auth.users u ON u.id = o.buyer_id
WHERE o.created_at > NOW() - INTERVAL '30 days'
  AND o.buyer_id != auth.uid()  -- Pedidos que NO son del UUID actual
GROUP BY o.buyer_id, u.email;

-- ============================================================================
-- PASO 2: TRANSFERIR PEDIDOS (DESCOMENTA Y EJECUTA SI CONFIRMAS)
-- ============================================================================

/*
-- ⚠️ DESCOMENTA LAS SIGUIENTES LÍNEAS DESPUÉS DE VERIFICAR PASO 1

-- Actualizar pedidos donde eres el buyer
UPDATE orders_b2b 
SET 
  buyer_id = auth.uid(),
  updated_at = NOW()
WHERE buyer_id = 'REEMPLAZA_CON_UUID_ANTIGUO'  -- ⚠️ Reemplaza con el UUID del PASO 1
  AND buyer_id != auth.uid();  -- Solo si no es ya el actual

-- Actualizar pedidos donde eres el seller
UPDATE orders_b2b 
SET 
  seller_id = auth.uid(),
  updated_at = NOW()
WHERE seller_id = 'REEMPLAZA_CON_UUID_ANTIGUO'  -- ⚠️ Reemplaza con el UUID del PASO 1
  AND seller_id != auth.uid();

-- Si buyer y seller son el mismo (compras B2B propias), actualiza ambos
UPDATE orders_b2b 
SET 
  buyer_id = auth.uid(),
  seller_id = auth.uid(),
  updated_at = NOW()
WHERE buyer_id = 'REEMPLAZA_CON_UUID_ANTIGUO'
  AND seller_id = 'REEMPLAZA_CON_UUID_ANTIGUO';
*/

-- ============================================================================
-- PASO 3: VERIFICAR TRANSFERENCIA (EJECUTA DESPUÉS DEL PASO 2)
-- ============================================================================

/*
-- Ver pedidos DESPUÉS de la transferencia
SELECT 
  '✅ DESPUÉS DE TRANSFERENCIA' AS info,
  o.id,
  o.buyer_id,
  o.seller_id,
  o.status,
  o.total_amount,
  CASE 
    WHEN o.buyer_id = auth.uid() THEN '✅ SOY BUYER'
    WHEN o.seller_id = auth.uid() THEN '✅ SOY SELLER'
    ELSE '❌ NO SOY YO'
  END AS relacion
FROM orders_b2b o
WHERE o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 10;
*/

-- ============================================================================
-- 📋 INSTRUCCIONES PASO A PASO
-- ============================================================================
/*
1. Ejecuta VER_EMAILS_PEDIDOS.sql primero
2. Confirma que el email es el MISMO pero UUID diferente
3. Anota el UUID antiguo del PASO 1 de VER_EMAILS_PEDIDOS.sql
4. Ejecuta PASO 1 de este script (verificación)
5. Reemplaza 'REEMPLAZA_CON_UUID_ANTIGUO' con el UUID que anotaste
6. DESCOMENTA las queries del PASO 2
7. Ejecuta PASO 2 (transferencia)
8. DESCOMENTA y ejecuta PASO 3 (verificación)
9. Recarga el navegador (Ctrl+Shift+R)
10. Ve a "Mis Compras" para verificar

============================================================================
🎯 EJEMPLO DE USO
============================================================================

Si VER_EMAILS_PEDIDOS.sql muestra:
  UUID actual: 12345678-1234-1234-1234-123456789abc
  UUID antiguo: 7c635c9b-9971-403f-8fc4-b75436b33174
  Email: mismoEmail@example.com (en ambos)

Entonces reemplaza:
  'REEMPLAZA_CON_UUID_ANTIGUO' 
  por 
  '7c635c9b-9971-403f-8fc4-b75436b33174'

============================================================================
*/
