-- =============================================================================
-- AGREGAR POLÍTICAS RLS PARA LAS VISTAS DE COSTOS DE ENVÍO
-- Fecha: 2026-02-11
-- Propósito: Permitir que usuarios autenticados lean los costos de envío
-- =============================================================================

-- Habilitar RLS en las vistas si no está habilitado
ALTER TABLE public.v_product_shipping_costs SECURITY LABEL IS 'Shipping costs viewable by sellers';
ALTER TABLE public.v_cart_shipping_costs SECURITY LABEL IS 'Cart shipping costs viewable by sellers';

-- Crear políticas de lectura para usuarios autenticados
-- Las vistas son read-only, no necesitan INSERT/UPDATE/DELETE

-- Política para v_product_shipping_costs
CREATE POLICY "Sellers can view product shipping costs" ON v_product_shipping_costs
FOR SELECT
TO authenticated
USING (true);

-- Política para v_cart_shipping_costs
CREATE POLICY "Sellers can view cart shipping costs" ON v_cart_shipping_costs
FOR SELECT
TO authenticated
USING (true);

-- Políticas alternativas
CREATE POLICY "Public can view product shipping costs" ON v_product_shipping_costs
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public can view cart shipping costs" ON v_cart_shipping_costs
FOR SELECT
TO anon
USING (true);

-- Verificar que las políticas fueron creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('v_product_shipping_costs', 'v_cart_shipping_costs')
ORDER BY tablename, policyname;
