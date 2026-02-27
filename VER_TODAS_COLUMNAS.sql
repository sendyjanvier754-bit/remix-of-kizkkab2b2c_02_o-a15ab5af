-- ============================================================================
-- 🔍 VER TODAS LAS COLUMNAS DE orders_b2b y order_items_b2b
-- ============================================================================

-- 1. TODAS las columnas de orders_b2b
SELECT 
  '🔍 COLUMNAS orders_b2b' AS tipo,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
ORDER BY ordinal_position;

-- 2. TODAS las columnas de order_items_b2b
SELECT 
  '🔍 COLUMNAS order_items_b2b' AS tipo,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;
