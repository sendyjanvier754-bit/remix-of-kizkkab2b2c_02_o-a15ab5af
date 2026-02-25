-- ============================================================================
-- PROBAR POLÍTICAS RLS MANUALMENTE
-- ============================================================================

-- Esta query simula lo que hace el frontend
-- Reemplaza el UUID con tu user_id: 7c635c90-9971-403f-8fc4-b75438b33174

SELECT 
  *
FROM orders_b2b
WHERE (buyer_id = '7c635c90-9971-403f-8fc4-b75438b33174'::uuid 
   OR seller_id = '7c635c90-9971-403f-8fc4-b75438b33174'::uuid)
  AND status != 'draft'
ORDER BY created_at DESC;

-- ============================================================================
-- Si esto devuelve resultados, las políticas RLS funcionan correctamente
-- Si NO devuelve resultados, hay problema con las políticas
-- ============================================================================

-- También verifica que RLS está habilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('orders_b2b', 'order_items_b2b');

-- Debe mostrar rowsecurity = true para ambas tablas
