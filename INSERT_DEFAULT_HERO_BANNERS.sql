-- ============================================
-- INSERTAR BANNERS POR DEFECTO PARA EL HERO
-- ============================================
-- Este script inserta los banners por defecto del hero en la tabla admin_banners
-- para que sean configurables desde el módulo de administración

-- Eliminar banners existentes de tipo B2C (opcional)
-- DELETE FROM public.admin_banners WHERE target_audience IN ('b2c', 'all');

-- Insertar banners por defecto
INSERT INTO public.admin_banners (
  title,
  image_url,
  link_url,
  target_audience,
  is_active,
  sort_order
) VALUES
  (
    'Bienvenido a Siver',
    '/navidad-1.png',
    '/marketplace',
    'b2c',
    true,
    1
  ),
  (
    'Explora Nuestras Ofertas',
    '/navidad-2.png',
    '/marketplace',
    'b2c',
    true,
    2
  ),
  (
    'Nuevos Productos',
    '/navidad-3.png',
    '/marketplace',
    'b2c',
    true,
    3
  )
ON CONFLICT DO NOTHING;

-- Verificar los banners insertados
SELECT 
  id,
  title,
  image_url,
  link_url,
  target_audience,
  is_active,
  sort_order,
  created_at
FROM public.admin_banners
WHERE target_audience IN ('b2c', 'all')
ORDER BY sort_order;

-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================
-- 1. Ejecutar este script en la consola SQL de Supabase
-- 2. Los banners ahora son configurables desde /admin/banners
-- 3. Para cambiar las imágenes:
--    - Ir a /admin/banners
--    - Hacer clic en el botón de editar del banner
--    - Subir una nueva imagen o cambiar la URL
--    - Guardar los cambios
-- 
-- CAMPOS CONFIGURABLES:
-- - title: Título del banner (para referencia interna)
-- - image_url: URL de la imagen (puede ser ruta local o URL externa)
-- - link_url: URL a la que redirige al hacer clic en el banner
-- - target_audience: 'b2c' (público), 'sellers' (vendedores), 'all' (ambos)
-- - is_active: true/false para activar/desactivar el banner
-- - sort_order: Orden de aparición (menor número = primera posición)
-- - starts_at: Fecha de inicio (opcional, para banners temporales)
-- - ends_at: Fecha de fin (opcional, para banners temporales)
