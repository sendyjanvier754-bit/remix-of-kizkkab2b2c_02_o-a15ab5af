-- Verificar si la columna peso_kg existe en b2b_cart_items
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'b2b_cart_items'
  AND column_name = 'peso_kg';

-- Ver algunos items del carrito para verificar valores
SELECT 
  id,
  sku,
  product_id,
  variant_id,
  quantity,
  peso_kg,
  (peso_kg * quantity) as peso_total
FROM b2b_cart_items
LIMIT 10;
