-- Verificar que la función get_product_weight existe
SELECT 
  'Funciones RPC' as info,
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_product_weight';

-- Probar la función directamente
SELECT 
  'TEST función' as info,
  get_product_weight(
    '3f61c5dc-ed1c-491a-894e-44ae6d1e380c'::uuid,
    '29012345-5912-3456-7890-123456789012'::uuid
  ) as peso_calculado;
