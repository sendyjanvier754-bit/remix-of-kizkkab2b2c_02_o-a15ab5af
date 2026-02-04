-- EJECUTAR ESTO EN SUPABASE SQL EDITOR
-- Verificar qué campos tiene la vista actual
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'v_productos_con_precio_b2b' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
