-- ============================================
-- SIVER MARKET 509 - PRODUCTS DATA
-- Contains sample products and variants
-- Generated: 2026-01-26
-- ============================================

-- ============================================
-- PRODUCTS (B2B Catalog)
-- ============================================
INSERT INTO public.products (
  id, sku_interno, nombre, descripcion_corta, categoria_id, 
  costo_base_excel, precio_mayorista, moq, stock_fisico, 
  imagen_principal, galeria_imagenes, origin_country_id,
  is_parent, is_active, shipping_mode, stock_status
) VALUES
-- Product 1: Camiseta Premium
(
  '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5',
  '924221472',
  'Camiseta Premium de Verano con Cuello Redondo para Hombre',
  'Esta camiseta de manga corta para hombre presenta un dise































































































































-- ============================================-- END OF PRODUCTS DATA-- ============================================ON CONFLICT (id) DO NOTHING;('96789012-6789-0123-4567-890123456780', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Rojo-L', 'Rojo / L', 'color', 'Rojo', '{"color": "Rojo", "talla": "L"}', 0.88, 1.14, 47065, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Rojo-M.jpg'], 12, true)('85678901-5678-9012-3456-789012345679', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Rojo-M', 'Rojo / M', 'color', 'Rojo', '{"color": "Rojo", "talla": "M"}', 0.88, 1.14, 47070, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Rojo-M.jpg'], 12, true),('74567890-4567-8901-2345-678901234568', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Rojo-S', 'Rojo / S', 'color', 'Rojo', '{"color": "Rojo", "talla": "S"}', 0.88, 1.14, 47075, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Rojo-M.jpg'], 12, true),-- Rojo variants('63456789-3456-7890-1234-567890123457', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Blanco-L', 'Blanco / L', 'color', 'Blanco', '{"color": "Blanco", "talla": "L"}', 0.88, 1.14, 47080, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Blanco-S.jpg'], 12, true),('52345678-2345-6789-0123-456789012346', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Blanco-M', 'Blanco / M', 'color', 'Blanco', '{"color": "Blanco", "talla": "M"}', 0.88, 1.14, 47085, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Blanco-S.jpg'], 12, true),('41234567-1234-5678-9012-345678901235', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Blanco-S', 'Blanco / S', 'color', 'Blanco', '{"color": "Blanco", "talla": "S"}', 0.88, 1.14, 47090, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Blanco-S.jpg'], 12, true),-- Blanco variants('30123456-0123-4567-8901-234567890123', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Negro-L', 'Negro / L', 'color', 'Negro', '{"color": "Negro", "talla": "L"}', 0.88, 1.14, 47095, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Negro-S.jpg'], 12, true),('29012345-9012-3456-7890-123456789012', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Negro-M', 'Negro / M', 'color', 'Negro', '{"color": "Negro", "talla": "M"}', 0.88, 1.14, 47100, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Negro-S.jpg'], 12, true),('18901234-8901-2345-6789-012345678901', '3f61c5dc-ed1c-491a-894e-44ae6d1e380c', '758708899816-Negro-S', 'Negro / S', 'color', 'Negro', '{"color": "Negro", "talla": "S"}', 0.88, 1.14, 47105, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Negro-S.jpg'], 12, true),-- Negro variants) VALUES  images, moq, is_active  attribute_combination, cost_price, price, stock, stock_b2c,  id, product_id, sku, name, option_type, option_value,INSERT INTO public.product_variants (-- ============================================-- PRODUCT VARIANTS - Tanga Encaje (Product 3)-- ============================================ON CONFLICT (id) DO NOTHING;('07890123-7890-1234-5678-901234567890', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Negro-40', 'Negro / 40', 'color', 'Negro', '{"color": "Negro", "talla": "40"}', 4.11, 5.34, 9935, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Negro-39.jpg'], 3, true)('96789012-6789-0123-4567-890123456789', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Negro-39', 'Negro / 39', 'color', 'Negro', '{"color": "Negro", "talla": "39"}', 4.11, 5.34, 9940, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Negro-39.jpg'], 3, true),-- Negro variants('85678901-5678-9012-3456-789012345678', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Blanco-40', 'Blanco / 40', 'color', 'Blanco', '{"color": "Blanco", "talla": "40"}', 4.11, 5.34, 9945, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Blanco-39.jpg'], 3, true),('74567890-4567-8901-2345-678901234567', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Blanco-39', 'Blanco / 39', 'color', 'Blanco', '{"color": "Blanco", "talla": "39"}', 4.11, 5.34, 9950, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Blanco-39.jpg'], 3, true),-- Blanco variants('63456789-3456-7890-1234-567890123456', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-44', 'Azul / 44', 'color', 'Azul', '{"color": "Azul", "talla": "44"}', 4.11, 5.34, 9955, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),('52345678-2345-6789-0123-456789012345', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-43', 'Azul / 43', 'color', 'Azul', '{"color": "Azul", "talla": "43"}', 4.11, 5.34, 9960, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),('41234567-1234-5678-9012-345678901234', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-42', 'Azul / 42', 'color', 'Azul', '{"color": "Azul", "talla": "42"}', 4.11, 5.34, 9965, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),('30123456-f123-4567-8901-234567890123', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-41', 'Azul / 41', 'color', 'Azul', '{"color": "Azul", "talla": "41"}', 4.11, 5.34, 9970, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),('29012345-ef12-3456-7890-123456789012', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-40', 'Azul / 40', 'color', 'Azul', '{"color": "Azul", "talla": "40"}', 4.11, 5.34, 9975, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),('18901234-def1-2345-6789-012345678901', 'caf64d69-b9bb-4b49-9b3a-553227487d7a', '777795007250-Azul-39', 'Azul / 39', 'color', 'Azul', '{"color": "Azul", "talla": "39"}', 4.11, 5.34, 9980, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg'], 3, true),-- Azul variants) VALUES  images, moq, is_active  attribute_combination, cost_price, price, stock, stock_b2c,  id, product_id, sku, name, option_type, option_value,INSERT INTO public.product_variants (-- ============================================-- PRODUCT VARIANTS - Zapatillas (Product 2)-- ============================================ON CONFLICT (id) DO NOTHING;('07890123-cdef-1234-5678-901234567890', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-VerdeFruta-L', 'Verde Fruta / L', 'color', 'Verde Fruta', '{"color": "Verde Fruta", "talla": "L"}', 3.93, 5.11, 9945, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Verde_Fruta-M.jpg'], 3, true)('f6789012-bcde-f123-4567-890123456789', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-VerdeFruta-M', 'Verde Fruta / M', 'color', 'Verde Fruta', '{"color": "Verde Fruta", "talla": "M"}', 3.93, 5.11, 9950, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Verde_Fruta-M.jpg'], 3, true),-- Verde Fruta variants('e5f67890-abcd-ef12-3456-789012345678', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Rosa-L', 'Rosa / L', 'color', 'Rosa', '{"color": "Rosa", "talla": "L"}', 3.93, 5.11, 9955, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Rosa-M.jpg'], 3, true),('d4e56789-0abc-def1-2345-678901234567', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Rosa-M', 'Rosa / M', 'color', 'Rosa', '{"color": "Rosa", "talla": "M"}', 3.93, 5.11, 9960, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Rosa-M.jpg'], 3, true),-- Rosa variants('c3d45678-90ab-cdef-1234-567890123456', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-4XL', 'Negro / 4XL', 'color', 'Negro', '{"color": "Negro", "talla": "4XL"}', 3.93, 5.11, 9980, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),('b2c34567-890a-bcde-f123-456789012345', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-3XL', 'Negro / 3XL', 'color', 'Negro', '{"color": "Negro", "talla": "3XL"}', 3.93, 5.11, 9975, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),('a1b23456-7890-abcd-ef12-345678901234', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-2XL', 'Negro / 2XL', 'color', 'Negro', '{"color": "Negro", "talla": "2XL"}', 3.93, 5.11, 9970, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),('9737bc6e-6022-4dc7-b2eb-ec525bd316dd', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-XL', 'Negro / XL', 'color', 'Negro', '{"color": "Negro", "talla": "XL"}', 3.93, 5.11, 9965, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),('70be7443-13be-4335-8769-dfb718f98f5b', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-L', 'Negro / L', 'color', 'Negro', '{"color": "Negro", "talla": "L"}', 3.93, 5.11, 9964, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),('57c70683-50e9-4b12-b44e-c89065617f06', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Negro-M', 'Negro / M', 'color', 'Negro', '{"color": "Negro", "talla": "M"}', 3.93, 5.11, 9978, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg'], 3, true),-- Negro variants('f4b072b9-6865-4ae6-8616-fee58e8c7f09', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-4XL', 'Blanco / 4XL', 'color', 'Blanco', '{"color": "Blanco", "talla": "4XL"}', 3.93, 5.11, 9982, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),('60b1854a-7a1f-4b1b-9862-15275c9a1a9b', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-3XL', 'Blanco / 3XL', 'color', 'Blanco', '{"color": "Blanco", "talla": "3XL"}', 3.93, 5.11, 9969, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),('8932f45a-6598-4b62-83a1-69ad711af67e', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-2XL', 'Blanco / 2XL', 'color', 'Blanco', '{"color": "Blanco", "talla": "2XL"}', 3.93, 5.11, 9958, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),('07baf5ac-549a-4d2d-81fc-f66e129cd32a', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-XL', 'Blanco / XL', 'color', 'Blanco', '{"color": "Blanco", "talla": "XL"}', 3.93, 5.11, 9943, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),('32b3c493-039c-4dd9-bfb3-112bd613deec', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-L', 'Blanco / L', 'color', 'Blanco', '{"color": "Blanco", "talla": "L"}', 3.93, 5.11, 9951, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),('d45fc88c-c016-47af-ab9d-701f18fbd96a', '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5', '924221472274-Blanco-M', 'Blanco / M', 'color', 'Blanco', '{"color": "Blanco", "talla": "M"}', 3.93, 5.11, 9963, 0, ARRAY['https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg'], 3, true),-- Blanco variants) VALUES  images, moq, is_active  attribute_combination, cost_price, price, stock, stock_b2c,  id, product_id, sku, name, option_type, option_value,INSERT INTO public.product_variants (-- ============================================-- PRODUCT VARIANTS - Camiseta (Product 1)-- ============================================ON CONFLICT (id) DO NOTHING;)  true, true, 'standard', 'in_stock'  '0214bc6e-ba17-422a-b6da-5cc4a42beae2', -- China  ],    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Rojo-M.jpg'    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Blanco-S.jpg',    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Negro-S.jpg',  ARRAY[  'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/758708899816-Negro-S.jpg',  0.88, 1.14, 12, 565267,  'cc065a8d-c16c-40dc-ac6a-e3e4e9d935b6', -- Ropa Interior y Pijamas  'Ropa interior sexy de encaje con dise f1o de lazo elegante y seductor perfecta para el comercio exterior con acabados de alta calidad y ajuste c f3modo',  'Tanga de Encaje con Lazo Estilo Europeo para Mujer',  '758708899',  '3f61c5dc-ed1c-491a-894e-44ae6d1e380c',(-- Product 3: Tanga de Encaje),  true, true, 'standard', 'in_stock'  '0214bc6e-ba17-422a-b6da-5cc4a42beae2', -- China  ],    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Negro-39.jpg'    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Blanco-39.jpg',    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg',  ARRAY[  'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/777795007250-Azul-39.jpg',  4.11, 5.34, 3, 179544,  '4021d9a9-f910-41cb-8682-b5badee48659', -- Zapatos  'Zapatillas casuales de estilo coreano ideales para el oto f1o con suela suave y dise f1o transpirable perfectas para correr o uso diario juvenil',  'Zapatillas Deportivas Transpirables de Oto f1o Casuales para Hombre',  '777795007',  'caf64d69-b9bb-4b49-9b3a-553227487d7a',(-- Product 2: Zapatillas Deportivas),  true, true, 'standard', 'in_stock'  '0214bc6e-ba17-422a-b6da-5cc4a42beae2', -- China  ],    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Verde_Fruta-M.jpg'    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Rosa-M.jpg',    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Negro-M.jpg',    'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg',  ARRAY[  'https://iqpkfxkqxoodlwvnrpki.supabase.co/storage/v1/object/public/product-images/products/924221472274-Blanco-M.jpg',  3.93, 5.11, 3, 239281,  '53855a0d-d33e-4ad0-837d-f9bf42259876', -- Hombreo de cuello redondo y estilo juvenil perfecto para el verano 2025 fabricada con materiales ligeros que ofrecen frescura y durabilidad en un corte moderno vers til para cualquier ocasi on casual',