-- ============================================================================
-- 🔧 ADD: Columna role a profiles + sincronización con user_roles
-- ============================================================================
-- Este script:
-- 1. Agrega columna role a profiles
-- 2. Sincroniza role desde user_roles (usa el rol más prioritario)
-- 3. Crea trigger para mantener sincronización automática
-- 4. Actualiza RLS policies para usar profiles.role
-- ============================================================================

-- ============================================================================
-- PASO 1: Agregar columna role a profiles
-- ============================================================================

-- Agregar columna role (tipo app_role)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

COMMENT ON COLUMN public.profiles.role IS 
'Rol principal del usuario (sincronizado desde user_roles). Prioridad: admin > seller > user';

-- ============================================================================
-- PASO 2: Sincronizar roles existentes desde user_roles
-- ============================================================================

-- Función para obtener el rol principal (prioridad: admin > seller > user)
CREATE OR REPLACE FUNCTION get_primary_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Buscar en orden de prioridad
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'seller' THEN 2
      WHEN 'user' THEN 3
      ELSE 4
    END
  LIMIT 1;
  
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql;

-- Actualizar todos los profiles con su rol principal
UPDATE public.profiles p
SET role = get_primary_role(p.id)
WHERE EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
);

-- ============================================================================
-- PASO 3: Crear función y trigger para sincronización automática
-- ============================================================================

-- Función que sincroniza role cuando cambia user_roles
CREATE OR REPLACE FUNCTION sync_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar profiles.role con el rol principal del usuario
  UPDATE public.profiles
  SET role = get_primary_role(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.user_id
      ELSE NEW.user_id
    END
  ),
  updated_at = NOW()
  WHERE id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.user_id
    ELSE NEW.user_id
  END;
  
  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS trigger_sync_profile_role ON user_roles;

-- Crear trigger en user_roles (INSERT, UPDATE, DELETE)
CREATE TRIGGER trigger_sync_profile_role
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_role();

-- ============================================================================
-- PASO 4: Crear trigger para NUEVOS usuarios (inicializar role)
-- ============================================================================

-- Función para inicializar profile con role por defecto
CREATE OR REPLACE FUNCTION init_new_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el profile no tiene role, asignar 'user' por defecto
  IF NEW.role IS NULL THEN
    NEW.role := 'user';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger antiguo si existe
DROP TRIGGER IF EXISTS trigger_init_profile_role ON profiles;

-- Crear trigger en profiles (INSERT)
CREATE TRIGGER trigger_init_profile_role
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION init_new_profile_role();

-- ============================================================================
-- PASO 5: Actualizar RLS policies para usar profiles.role
-- ============================================================================

-- Eliminar policies antiguas de orders_b2b
DROP POLICY IF EXISTS "orders_b2b_all_for_admins" ON orders_b2b;

-- Crear policy nueva que permite usar profiles.role O user_roles
CREATE POLICY "orders_b2b_all_for_admins"
ON orders_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Eliminar policies antiguas de order_items_b2b
DROP POLICY IF EXISTS "order_items_b2b_all_for_admins" ON order_items_b2b;

-- Crear policy nueva
CREATE POLICY "order_items_b2b_all_for_admins"
ON order_items_b2b
FOR ALL
TO authenticated
USING (
  -- Método 1: Usando profiles.role (más rápido)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Método 2: Fallback usando user_roles
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================================================
-- ✅ VERIFICACIÓN
-- ============================================================================

-- Ver columnas de profiles
SELECT 
  '✅ COLUMNAS profiles' AS tipo,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('id', 'email', 'full_name', 'role', 'created_at')
ORDER BY ordinal_position;

-- Ver algunos perfiles con sus roles
SELECT 
  '✅ PERFILES CON ROL' AS tipo,
  p.id,
  p.email,
  p.role AS profile_role,
  STRING_AGG(ur.role::TEXT, ', ') AS user_roles_roles
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
GROUP BY p.id, p.email, p.role
LIMIT 10;

-- Ver triggers creados
SELECT 
  '✅ TRIGGERS' AS tipo,
  trigger_name,
  event_manipulation AS evento,
  event_object_table AS tabla
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%profile%role%'
ORDER BY event_object_table, trigger_name;

-- Verificar policies actualizadas
SELECT 
  '✅ POLICIES ADMIN' AS tipo,
  tablename,
  policyname,
  cmd AS operacion
FROM pg_policies
WHERE tablename IN ('orders_b2b', 'order_items_b2b')
  AND policyname LIKE '%admin%'
ORDER BY tablename, policyname;

-- ============================================================================
-- 📋 INSTRUCCIONES POST-EJECUCIÓN
-- ============================================================================
/*
✅ CAMBIOS APLICADOS:

1. Columna role agregada a profiles:
   - Tipo: TEXT
   - Default: 'user'
   - Sincronizada automáticamente con user_roles

2. Función get_primary_role():
   - Retorna el rol más prioritario: admin > seller > user
   - Se usa para mantener profiles.role actualizado

3. Trigger sync_profile_role:
   - Se ejecuta al INSERT/UPDATE/DELETE en user_roles
   - Actualiza automáticamente profiles.role
   - Garantiza sincronización permanente

4. RLS policies actualizadas:
   - Ahora revisan profiles.role (más rápido)
   - Con fallback a user_roles (por seguridad)

5. Datos existentes:
   - Todos los profiles actualizados con su rol principal

PRÓXIMOS PASOS:
1. Ejecuta este script en Supabase SQL Editor
2. Verifica los resultados de verificación al final
3. Recarga la aplicación (Ctrl+Shift+R)
4. Ve a "Mis Compras" → deberías ver tus pedidos

NOTA IMPORTANTE:
- De ahora en adelante, puedes usar profiles.role en JOINs y queries
- Ejemplo: SELECT * FROM profiles WHERE role = 'admin'
- Los cambios en user_roles se reflejan automáticamente en profiles.role

============================================================================
*/
