-- =====================================================
-- PASO 2: Eliminar función anterior (si existe)
-- =====================================================

DROP FUNCTION IF EXISTS get_inventario_b2c(UUID, TEXT, INTEGER) CASCADE;
