-- ============================================================================
-- 🔍 DIAGNÓSTICO: Pedidos Afectados por Bug de order_items_b2b
-- ============================================================================
-- Propósito: Identificar pedidos que se crearon sin items por usar columna incorrecta
-- Ejecutar: Después de aplicar el fix del código

-- ============================================================================
-- PASO 1: Identificar Pedidos SIN Items (Afectados por el Bug)
-- ============================================================================

SELECT 
  o.id,
  o.created_at,
  o.buyer_id,
  u.email AS buyer_email,
  o.seller_id,
  o.total_amount,
  o.total_quantity,
  o.status,
  o.payment_status,
  o.payment_method,
  COUNT(oi.id) AS num_items_actual,
  CASE 
    WHEN COUNT(oi.id) = 0 AND o.status != 'draft' THEN '❌ BUG CONFIRMADO - Sin items'
    WHEN COUNT(oi.id) = 0 AND o.status = 'draft' THEN '⚠️ Draft sin items (normal)'
    WHEN COUNT(oi.id) > 0 THEN '✅ OK - Con items'
    ELSE '❓ Revisar'
  END AS diagnostico
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
LEFT JOIN auth.users u ON u.id = o.buyer_id
WHERE o.created_at > NOW() - INTERVAL '30 days'  -- Últimos 30 días
GROUP BY o.id, o.created_at, o.buyer_id, u.email, o.seller_id, 
         o.total_amount, o.total_quantity, o.status, o.payment_status, o.payment_method
HAVING COUNT(oi.id) = 0  -- Solo pedidos sin items
  AND o.status != 'draft'  -- Excluir drafts normales
ORDER BY o.created_at DESC;

-- ============================================================================
-- PASO 2: Estadísticas del Problema
-- ============================================================================

SELECT 
  '📊 RESUMEN DEL BUG' AS seccion,
  COUNT(DISTINCT o.id) AS total_pedidos_afectados,
  COALESCE(SUM(o.total_amount), 0) AS valor_total_perdido_usd,
  MIN(o.created_at) AS primer_pedido_afectado,
  MAX(o.created_at) AS ultimo_pedido_afectado,
  COUNT(DISTINCT o.buyer_id) AS usuarios_afectados,
  COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) AS pedidos_pagados_afectados
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE oi.id IS NULL  -- Sin items
  AND o.status != 'draft'  -- Excluir borradores
  AND o.created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- PASO 3: Detalles de Usuarios Afectados
-- ============================================================================

SELECT 
  u.email AS usuario_email,
  p.full_name AS nombre_completo,
  COUNT(DISTINCT o.id) AS pedidos_sin_items,
  SUM(o.total_amount) AS total_valor_usd,
  MIN(o.created_at) AS primer_pedido,
  MAX(o.created_at) AS ultimo_pedido,
  ARRAY_AGG(o.id ORDER BY o.created_at DESC) AS order_ids
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
LEFT JOIN auth.users u ON u.id = o.buyer_id
LEFT JOIN profiles p ON p.id = o.buyer_id
WHERE oi.id IS NULL
  AND o.status != 'draft'
  AND o.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, p.full_name
ORDER BY pedidos_sin_items DESC, total_valor_usd DESC;

-- ============================================================================
-- PASO 4: Comparar Pedidos Buenos vs Afectados
-- ============================================================================

WITH order_stats AS (
  SELECT 
    o.id,
    o.created_at,
    o.total_amount,
    COUNT(oi.id) AS num_items,
    CASE 
      WHEN COUNT(oi.id) = 0 THEN 'Sin Items (Bug)'
      ELSE 'Con Items (OK)'
    END AS tipo
  FROM orders_b2b o
  LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
  WHERE o.created_at > NOW() - INTERVAL '30 days'
    AND o.status != 'draft'
  GROUP BY o.id, o.created_at, o.total_amount
)
SELECT 
  tipo,
  COUNT(*) AS cantidad_pedidos,
  ROUND(AVG(total_amount), 2) AS promedio_usd,
  SUM(total_amount) AS total_usd,
  MIN(created_at) AS desde,
  MAX(created_at) AS hasta
FROM order_stats
GROUP BY tipo
ORDER BY tipo;

-- ============================================================================
-- PASO 5: Verificar si hay Carritos que Podrían Recuperarse
-- ============================================================================

-- Intenta encontrar b2b_carts que podrían corresponder a pedidos sin items
SELECT 
  o.id AS order_id,
  o.created_at AS order_fecha,
  o.buyer_id,
  o.total_amount AS order_total,
  c.id AS cart_id,
  c.created_at AS cart_fecha,
  COUNT(ci.id) AS cart_items_count,
  SUM(ci.quantity * ci.unit_price) AS cart_total,
  CASE 
    WHEN ABS(o.total_amount - SUM(ci.quantity * ci.unit_price)) < 0.01 
    THEN '✅ COINCIDE - Recuperable'
    ELSE '⚠️ No coincide exactamente'
  END AS recuperable
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
LEFT JOIN b2b_carts c ON c.buyer_user_id = o.buyer_id 
  AND c.status = 'completed'
  AND DATE(c.created_at) = DATE(o.created_at)  -- Mismo día
LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
WHERE oi.id IS NULL  -- Pedidos sin items
  AND o.status != 'draft'
  AND o.created_at > NOW() - INTERVAL '30 days'
GROUP BY o.id, o.created_at, o.buyer_id, o.total_amount, c.id, c.created_at
HAVING COUNT(ci.id) > 0  -- Solo si encontró items en carrito
ORDER BY o.created_at DESC;

-- ============================================================================
-- PASO 6: Lista para Contactar Usuarios (si hay afectados)
-- ============================================================================

SELECT 
  '📧 USUARIOS A CONTACTAR' AS tipo,
  u.email,
  p.full_name AS nombre,
  p.phone AS telefono,
  COUNT(DISTINCT o.id) AS pedidos_afectados,
  STRING_AGG(DISTINCT '#' || SUBSTRING(o.id::text, 1, 8), ', ') AS pedido_ids,
  SUM(o.total_amount) AS total_valor_usd,
  MAX(o.created_at) AS ultimo_pedido_fecha
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
JOIN auth.users u ON u.id = o.buyer_id
LEFT JOIN profiles p ON p.id = o.buyer_id
WHERE oi.id IS NULL
  AND o.status != 'draft'
  AND o.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, p.full_name, p.phone
ORDER BY pedidos_afectados DESC, total_valor_usd DESC;

-- ============================================================================
-- PASO 7: Verificar que el Fix Funciona (Pedidos Nuevos)
-- ============================================================================

-- Ejecutar DESPUÉS de aplicar el fix y hacer un pedido de prueba
SELECT 
  o.id,
  o.created_at,
  o.status,
  o.total_amount,
  COUNT(oi.id) AS num_items,
  CASE 
    WHEN COUNT(oi.id) > 0 THEN '✅ FIX FUNCIONA'
    ELSE '❌ SIGUE FALLANDO'
  END AS estado_fix
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '1 hour'  -- Última hora
GROUP BY o.id, o.created_at, o.status, o.total_amount
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 📝 INSTRUCCIONES DE USO
-- ============================================================================

/*
1. PASO 1: Ejecuta primero para ver lista detallada de pedidos afectados
   - Si no hay resultados: ¡Excelente! No hay pedidos afectados
   - Si hay resultados: Anota los order_ids para seguimiento

2. PASO 2: Ejecuta para ver el impacto total del bug
   - total_pedidos_afectados: Cantidad de pedidos sin items
   - valor_total_perdido_usd: Valor monetario afectado
   - usuarios_afectados: Cuántos clientes tienen pedidos sin items

3. PASO 3: Ejecuta para ver qué usuarios contactar
   - Lista de emails de usuarios afectados
   - Cuántos pedidos tienen sin items cada uno

4. PASO 4: Ejecuta para ver comparación
   - Porcentaje de pedidos afectados vs buenos

5. PASO 5: Ejecuta si quieres intentar recuperar datos
   - Muestra si hay carritos con los items originales
   - Solo útil si los carritos no se borraron

6. PASO 6: Ejecuta para obtener lista de contacto
   - Emails y teléfonos de usuarios afectados
   - Úsalo para enviar notificaciones o compensaciones

7. PASO 7: Ejecuta después de aplicar fix
   - Haz un pedido de prueba
   - Verifica que ahora SÍ se crean los items

============================================================================
🎯 ACCIONES SEGÚN RESULTADO
============================================================================

SI NO HAY PEDIDOS AFECTADOS:
  ✅ ¡Perfecto! El bug no causó daño
  ✅ El fix previene problemas futuros
  ✅ No se requiere acción adicional

SI HAY PEDIDOS AFECTADOS:
  1. Ejecuta PASO 6 para obtener lista de usuarios
  2. Envía email explicando el error técnico
  3. Ofrece:
     - Rehacer el pedido sin costo adicional
     - Descuento de compensación
     - Soporte priorizado
  4. Documenta para auditoría

SI HAY MUCHOS PEDIDOS AFECTADOS (>10):
  1. Pausa creación de pedidos temporalmente
  2. Verifica que el fix se aplicó correctamente
  3. Haz pedido de prueba (PASO 7)
  4. Si funciona, reactiva sistema
  5. Contacta usuarios en lotes

============================================================================
*/
