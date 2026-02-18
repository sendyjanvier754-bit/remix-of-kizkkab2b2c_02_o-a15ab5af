-- =============================================================================
-- MIGRACIÓN: Agregar route_id a b2b_carts para guardar ruta de envío
-- =============================================================================
-- PROPÓSITO: Permitir que cada carrito guarde su ruta de envío seleccionada
-- IMPACTO: Frontend podrá guardar/leer la ruta seleccionada por el usuario
-- =============================================================================

-- 1. Agregar columna route_id a b2b_carts
ALTER TABLE public.b2b_carts
ADD COLUMN IF NOT EXISTS route_id UUID 
REFERENCES public.shipping_routes(id) ON DELETE SET NULL;

-- 2. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_b2b_carts_route_id 
ON public.b2b_carts(route_id);

-- 3. Establecer ruta por defecto (China → Haití) para carritos existentes sin ruta
UPDATE public.b2b_carts
SET route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
WHERE route_id IS NULL;

-- 4. Comentar la columna para documentación
COMMENT ON COLUMN public.b2b_carts.route_id IS 
  'Ruta de envío seleccionada por el usuario para este carrito. Por defecto: China → Haití';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- Ver estructura actualizada de b2b_carts
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE 
    WHEN column_name = 'route_id' THEN '✅ NUEVA COLUMNA'
    ELSE '✓'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'b2b_carts'
ORDER BY ordinal_position;

-- Ver carritos con sus rutas asignadas
SELECT 
  '🛒 CARRITOS CON RUTAS' as info,
  bc.id,
  bc.buyer_user_id,
  bc.route_id,
  CONCAT(sr.origin_country, ' → ', sr.destination_country) as ruta,
  COUNT(bci.id) as items_count
FROM b2b_carts bc
LEFT JOIN shipping_routes sr ON bc.route_id = sr.id
LEFT JOIN b2b_cart_items bci ON bci.cart_id = bc.id
WHERE bc.status = 'open'
GROUP BY bc.id, bc.buyer_user_id, bc.route_id, sr.origin_country, sr.destination_country
LIMIT 10;

-- =============================================================================
-- RESULTADO
-- =============================================================================

SELECT 
  '✅ Columna route_id agregada a b2b_carts' as resultado,
  '🔗 Foreign key a shipping_routes configurado' as cambio_1,
  '📍 Carritos existentes tienen ruta por defecto' as cambio_2,
  '⚡ Índice creado para mejor performance' as cambio_3;
