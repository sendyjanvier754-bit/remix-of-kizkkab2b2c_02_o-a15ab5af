-- ============================================================================
-- 🔍 DIAGNÓSTICO: Error 400 en query de orders_b2b
-- ============================================================================
-- Verificar por qué la query de orders_b2b da error 400
-- ============================================================================

-- 1. Verificar foreign keys de orders_b2b
SELECT 
  '🔍 1. FOREIGN KEYS orders_b2b' AS tipo,
  tc.constraint_name AS fkey_name,
  kcu.column_name AS columna,
  ccu.table_name AS tabla_referenciada,
  ccu.column_name AS columna_referenciada
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'orders_b2b'
ORDER BY tc.constraint_name;

-- 2. Verificar si existe seller_id fkey específicamente
SELECT 
  '🔍 2. FKEY seller_id' AS tipo,
  constraint_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'orders_b2b'
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%seller%';

-- 3. Verificar policies de profiles (todas las SELECT)
SELECT 
  '🔍 3. POLICIES profiles SELECT' AS tipo,
  policyname,
  cmd AS operacion,
  permissive AS permisive_or_restrictive,
  roles,
  LEFT(qual::text, 100) AS condicion
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 4. Verificar policies de order_items_b2b
SELECT 
  '🔍 4. POLICIES order_items_b2b' AS tipo,
  policyname,
  cmd AS operacion,
  permissive AS permisive_or_restrictive,
  LEFT(qual::text, 80) AS condicion
FROM pg_policies
WHERE tablename = 'order_items_b2b'
ORDER BY cmd, policyname;

-- 5. Verificar policies de products
SELECT 
  '🔍 5. POLICIES products' AS tipo,
  policyname,
  cmd AS operacion,
  LEFT(qual::text, 100) AS condicion
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- 6. Probar query simple de orders_b2b
SELECT 
  '🔍 6. TEST SIMPLE orders_b2b' AS tipo,
  id,
  status,
  buyer_id,
  seller_id,
  created_at
FROM orders_b2b
WHERE buyer_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
   OR seller_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
LIMIT 3;

-- 7. Probar query con JOIN a profiles (esto puede fallar)
SELECT 
  '🔍 7. TEST JOIN profiles' AS tipo,
  o.id AS order_id,
  o.status,
  p.full_name AS seller_name,
  p.email AS seller_email
FROM orders_b2b o
LEFT JOIN profiles p ON p.id = o.seller_id
WHERE o.buyer_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
   OR o.seller_id = '376067ef-7629-47f1-be38-bbf8d728ddf0'
LIMIT 3;

-- 8. Verificar columnas de profiles (que existan full_name y email)
SELECT 
  '🔍 8. COLUMNAS profiles' AS tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('id', 'full_name', 'email', 'role')
ORDER BY column_name;

-- ============================================================================
-- 📋 ANÁLISIS DEL RESULTADO
-- ============================================================================
/*
BUSCAR EN LOS RESULTADOS:

1. Foreign Keys:
   - Debe existir orders_b2b_seller_id_fkey apuntando a profiles(id)
   - Si NO existe, el query falla con 400

2. Policies de profiles:
   - Debe tener profiles_select_public con USING (true)
   - Si está muy restrictiva, bloquea el JOIN

3. Policies de order_items_b2b:
   - Deben permitir SELECT si eres buyer o seller del orden padre
   - Si bloquean acceso, el query falla

4. Test simple:
   - Si esta query falla, el problema es RLS en orders_b2b
   - Si funciona, el problema es con los JOINs

5. Test JOIN:
   - Si falla aquí, el problema es RLS en profiles
   - Error común: no puedes ver profiles de otros usuarios

PRÓXIMOS PASOS SEGÚN RESULTADO:
- Si falta fkey → crearla
- Si profiles bloquea → ajustar policy
- Si order_items_b2b bloquea → ajustar policy
- Si todo OK aquí pero falla en frontend → problema en sintaxis del query
*/
