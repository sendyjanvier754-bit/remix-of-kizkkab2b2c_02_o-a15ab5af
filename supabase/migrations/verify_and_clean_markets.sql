-- ============================================================================
-- VERIFICAR Y LIMPIAR MERCADOS DUPLICADOS
-- ============================================================================

-- 1. Ver todos los mercados existentes
SELECT 
  id,
  code,
  name,
  destination_country_id,
  is_active,
  created_at
FROM public.markets
ORDER BY created_at DESC;

-- 2. Si necesitas eliminar el mercado "HT" existente (CUIDADO: esto borra datos)
-- DESCOMENTA SOLO SI ESTÁS SEGURO:
-- DELETE FROM public.markets WHERE code = 'HT';

-- 3. O si prefieres actualizar el mercado existente en lugar de crear uno nuevo
-- DESCOMENTA Y AJUSTA:
-- UPDATE public.markets 
-- SET 
--   name = 'Haiti',
--   description = 'Descripción opcional del mercado',
--   is_active = true
-- WHERE code = 'HT';
