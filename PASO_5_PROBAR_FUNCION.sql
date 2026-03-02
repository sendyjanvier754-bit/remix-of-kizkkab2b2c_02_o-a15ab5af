-- =====================================================
-- PASO 5: Probar la función
-- =====================================================

-- Ver si retorna datos
SELECT * FROM get_inventario_b2c() LIMIT 3;

-- Ver cuántos registros hay
SELECT COUNT(*) as total_items FROM get_inventario_b2c();

-- Ver por estado
SELECT 
  availability_status,
  COUNT(*) as cantidad
FROM get_inventario_b2c()
GROUP BY availability_status;
