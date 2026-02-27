-- =====================================================
-- CREAR VENDEDORES DESDE TIENDAS EXISTENTES
-- =====================================================
-- Crea registros en 'sellers' para todos los dueños de tiendas
-- que tienen rol 'seller' o 'admin'
-- =====================================================

BEGIN;

-- 1. Verificar usuarios con roles y tiendas
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.user_code,
  p.role,
  s.id as store_id,
  s.slug as store_slug,
  s.name as store_name,
  CASE 
    WHEN sel.id IS NOT NULL THEN '✅ YA ES VENDEDOR'
    ELSE '❌ FALTA CREAR VENDEDOR'
  END as estado
FROM profiles p
LEFT JOIN stores s ON s.owner_user_id = p.id
LEFT JOIN sellers sel ON sel.user_id = p.id
WHERE p.role IN ('seller', 'admin')
ORDER BY p.created_at DESC;

-- 2. Crear vendedores para usuarios con tiendas
INSERT INTO sellers (
  user_id,
  store_id,
  business_name,
  business_type,
  is_verified,
  verification_status,
  commission_rate,
  is_active
)
SELECT 
  s.owner_user_id as user_id,
  s.id as store_id,
  s.name as business_name,
  'retail' as business_type,
  CASE 
    WHEN p.role = 'admin' THEN true
    ELSE false
  END as is_verified,
  CASE 
    WHEN p.role = 'admin' THEN 'verified'::verification_status
    ELSE 'pending_verification'::verification_status
  END as verification_status,
  10.00 as commission_rate,
  true as is_active
FROM stores s
JOIN profiles p ON s.owner_user_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM sellers sel WHERE sel.user_id = s.owner_user_id
)
AND p.role IN ('seller', 'admin');

-- 3. Verificar resultados
SELECT 
  sel.id as seller_id,
  sel.user_id,
  p.full_name,
  p.email,
  p.user_code as user_code_kz,
  sel.business_name,
  sel.store_id,
  s.slug as store_slug_k,
  sel.is_verified,
  sel.verification_status,
  sel.commission_rate,
  sel.created_at
FROM sellers sel
JOIN profiles p ON sel.user_id = p.id
LEFT JOIN stores s ON sel.store_id = s.id
ORDER BY sel.created_at DESC;

-- 4. Resumen final
SELECT 
  '📊 RESUMEN' as tipo,
  COUNT(DISTINCT s.id) as total_tiendas,
  COUNT(DISTINCT sel.id) as total_vendedores,
  COUNT(DISTINCT p.id) as total_usuarios_con_rol
FROM profiles p
LEFT JOIN stores s ON s.owner_user_id = p.id
LEFT JOIN sellers sel ON sel.user_id = p.id
WHERE p.role IN ('seller', 'admin');

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Todos los dueños de tiendas tienen registro en 'sellers'
-- ✅ Cada vendedor conectado con su tienda vía store_id
-- ✅ AdminVendedores mostrará la lista completa
-- ✅ IDs de usuario (KZ...) e IDs de tienda (K...) visibles
-- =====================================================
