-- ============================================================================
-- RECARGAR EL SCHEMA CACHE DE POSTGREST
-- ============================================================================
-- Cuando se hacen cambios en la base de datos (políticas RLS, foreign keys, etc)
-- PostgREST mantiene un caché desactualizado que causa errores PGRST200

-- Opción 1: Notificar a PostgREST para recargar el schema
NOTIFY pgrst, 'reload schema';

-- Opción 2: Notificar recarga de configuración
NOTIFY pgrst, 'reload config';

-- ============================================================================
-- VERIFICAR FOREIGN KEYS DE orders_b2b
-- ============================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'orders_b2b';

-- ============================================================================
-- VERIFICAR POLÍTICAS RLS EN profiles
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';
