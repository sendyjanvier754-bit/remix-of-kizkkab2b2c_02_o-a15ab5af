-- ============================================================================
-- 🔍 VERIFICAR ESTRUCTURA REAL DE order_items_b2b
-- ============================================================================
-- Propósito: Confirmar si la columna se llama 'subtotal' o 'precio_total'
-- Motivo: Hay inconsistencias entre SellerCheckout.tsx y useB2BCartSupabase.ts

-- ============================================================================
-- PASO 1: Ver estructura completa de order_items_b2b
-- ============================================================================

SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- Si la columna es 'subtotal':
--   ✅ useB2BCartSupabase.ts está correcto
--   ❌ SellerCheckout.tsx está incorrecto
--   ❌ types.ts está incorrecto
--
-- Si la columna es 'precio_total':
--   ✅ SellerCheckout.tsx está correcto
--   ✅ types.ts está correcto
--   ❌ useB2BCartSupabase.ts está incorrecto

-- ============================================================================
-- PASO 2: Ver datos reales (primeras 5 filas)
-- ============================================================================

SELECT 
  id,
  order_id,
  product_id,
  sku,
  nombre,
  cantidad,
  precio_unitario,
  -- Intenta seleccionar ambas columnas para ver cuál existe:
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'order_items_b2b' 
        AND column_name = 'precio_total'
    ) THEN 'La columna es precio_total'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'order_items_b2b' 
        AND column_name = 'subtotal'
    ) THEN 'La columna es subtotal'
    ELSE 'COLUMNA NO ENCONTRADA'
  END AS verificacion,
  created_at
FROM order_items_b2b
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- PASO 3: Query alternativa si hay error en PASO 2
-- ============================================================================

-- Si el PASO 2 da error, ejecuta esta query simple:
-- SELECT * FROM order_items_b2b LIMIT 3;

-- ============================================================================
-- PASO 4: Verificar si hay pedidos que NO tienen items
-- ============================================================================

-- Esto puede pasar si useB2BCartSupabase.ts falló al insertar items
-- por usar nombre de columna incorrecto

SELECT 
  o.id AS order_id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.created_at,
  COUNT(oi.id) AS num_items,
  CASE 
    WHEN COUNT(oi.id) = 0 THEN '❌ SIN ITEMS - Posible error de inserción'
    WHEN COUNT(oi.id) > 0 THEN '✅ CON ITEMS - Inserción exitosa'
  END AS estado_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'  -- Solo últimos 7 días
GROUP BY o.id, o.status, o.payment_status, o.total_amount, o.created_at
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================================================
-- PASO 5: Buscar errores en logs (si hay extensión de logs)
-- ============================================================================

-- Esta query solo funciona si tienes pg_stat_statements habilitado
-- Si da error, simplemente ignórala

SELECT 
  query,
  calls,
  mean_exec_time,
  CASE 
    WHEN query LIKE '%subtotal%' AND query LIKE '%order_items_b2b%' THEN '⚠️ Usa subtotal'
    WHEN query LIKE '%precio_total%' AND query LIKE '%order_items_b2b%' THEN '⚠️ Usa precio_total'
    ELSE 'N/A'
  END AS tipo_columna
FROM pg_stat_statements
WHERE query LIKE '%order_items_b2b%'
  AND query LIKE '%INSERT%'
ORDER BY last_exec_time DESC
LIMIT 10;

-- ============================================================================
-- 📝 INSTRUCCIONES DE EJECUCIÓN
-- ============================================================================
-- 1. Ejecuta PASO 1 primero - Te dirá el nombre exacto de la columna
-- 2. Ejecuta PASO 4 - Te dirá si hay pedidos sin items (error de inserción)
-- 3. Basado en PASO 1, corrige el código según AUDITORIA_INCONSISTENCIA_ORDER_ITEMS.md
-- 4. PASO 5 es opcional (solo si tienes pg_stat_statements)

-- ============================================================================
-- 🎯 ACCIÓN SEGÚN RESULTADO
-- ============================================================================

-- Si PASO 1 muestra que la columna se llama 'subtotal':
--   → Corregir: SellerCheckout.tsx línea 282: cambiar 'precio_total' a 'subtotal'
--   → Regenerar types.ts desde Supabase
--   → useB2BCartSupabase.ts ya está correcto

-- Si PASO 1 muestra que la columna se llama 'precio_total':
--   → Corregir: useB2BCartSupabase.ts línea 358: cambiar 'subtotal' a 'precio_total'
--   → SellerCheckout.tsx ya está correcto
--   → types.ts ya está correcto
