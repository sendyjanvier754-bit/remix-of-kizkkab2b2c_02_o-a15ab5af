-- Ver datos de ejemplo de products

SELECT 
  '📦 MUESTRA: products (primeros 3)' as info,
  id,
  nombre,
  descripcion_corta,
  descripcion_larga,
  imagen_principal,
  galeria_imagenes
FROM products
WHERE is_active = true
LIMIT 3;
