-- =============================================================================
-- FIX: market_payment_methods — RLS policies para admins
-- ERROR: 403 "new row violates row-level security policy"
-- =============================================================================

-- Ver politicas actuales
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'market_payment_methods';

-- Habilitar RLS si no está habilitado
ALTER TABLE public.market_payment_methods ENABLE ROW LEVEL SECURITY;

-- Eliminar politicas antiguas si existen
DROP POLICY IF EXISTS "Admins can manage market_payment_methods" ON public.market_payment_methods;
DROP POLICY IF EXISTS "Authenticated users can read market_payment_methods" ON public.market_payment_methods;

-- Admins pueden hacer todo (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Admins can manage market_payment_methods"
ON public.market_payment_methods
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Usuarios autenticados pueden leer (para checkout, catálogos)
CREATE POLICY "Authenticated users can read market_payment_methods"
ON public.market_payment_methods
FOR SELECT
TO authenticated
USING (true);

-- Verificar
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'market_payment_methods';
