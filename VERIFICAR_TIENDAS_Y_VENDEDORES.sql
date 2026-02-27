-- =====================================================
-- VERIFICAR RELACIÓN ENTRE TIENDAS Y VENDEDORES
-- =====================================================

-- 1. Contar tiendas
SELECT 
  '🏪 TIENDAS' as tipo,
  COUNT(*) as total
FROM stores;

-- 2. Contar vendedores
SELECT 
  '👤 VENDEDORES' as tipo,
  COUNT(*) as total
FROM sellers;

-- 3. Ver tiendas con sus dueños
SELECT 
  s.id as store_id,
  s.slug as store_slug,
  s.name as store_name,
  s.owner_user_id,
  p.full_name as owner_name,
  p.email as owner_email,
  p.user_code,
  s.created_at
FROM stores s
LEFT JOIN profiles p ON s.owner_user_id = p.id
ORDER BY s.created_at DESC;

-- 4. Ver todos los vendedores (solo IDs primero)
SELECT 
  id,
  user_id,
  created_at
FROM sellers
ORDER BY created_at DESC;

-- 6. Ver estructura de la tabla sellers
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sellers'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Ver estructura de la tabla stores
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'stores'
  AND table_schema = 'public'
ORDER BY ordinal_position;
