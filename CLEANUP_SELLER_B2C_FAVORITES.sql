-- Eliminar favoritos B2C guardados incorrectamente para usuarios Seller
-- (registros creados cuando isB2BUser era false por bug de timing)
DELETE FROM public.b2c_favorites
WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'seller'
);

-- Verificar resultado
SELECT 'b2b_favorites' AS tabla, COUNT(*) AS total FROM public.b2b_favorites
UNION ALL
SELECT 'b2c_favorites' AS tabla, COUNT(*) AS total FROM public.b2c_favorites;
