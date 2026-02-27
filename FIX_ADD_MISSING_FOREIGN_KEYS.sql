-- ============================================================================
-- 🔧 SOLUCIÓN: Agregar foreign keys faltantes a orders_b2b
-- ============================================================================
-- PROBLEMA: El frontend usa named relationships pero faltan los foreign keys
-- seller_profile:profiles!orders_b2b_seller_id_fkey
-- buyer_profile:profiles!orders_b2b_buyer_id_fkey
-- ============================================================================

-- 1. Agregar foreign key para seller_id
ALTER TABLE orders_b2b
ADD CONSTRAINT orders_b2b_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- 2. Agregar foreign key para buyer_id  
ALTER TABLE orders_b2b
ADD CONSTRAINT orders_b2b_buyer_id_fkey
FOREIGN KEY (buyer_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- ============================================================================
-- ✅ VERIFICACIÓN
-- ============================================================================

SELECT 
  '✅ FOREIGN KEYS orders_b2b' AS tipo,
  constraint_name AS fkey_name,
  column_name AS columna
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
  AND constraint_name IN (
    'orders_b2b_seller_id_fkey',
    'orders_b2b_buyer_id_fkey'
  )
ORDER BY constraint_name;

-- ============================================================================
-- 📋 RESULTADO ESPERADO
-- ============================================================================
/*
✅ Deberías ver:
- orders_b2b_buyer_id_fkey → buyer_id
- orders_b2b_seller_id_fkey → seller_id

PRÓXIMOS PASOS:
1. Recarga la aplicación (Ctrl+Shift+R)
2. Ve a "Mis Compras"
3. El error 400 debe desaparecer
4. Deberías ver tus 2 pedidos (status: placed)
*/
