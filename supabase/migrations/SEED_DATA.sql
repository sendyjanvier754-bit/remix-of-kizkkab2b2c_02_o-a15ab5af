-- ============================================
-- SIVER MARKET 509 - SEED DATA
-- Insert this data after running the schema migration
-- Generated: 2026-01-25
-- ============================================

-- ============================================
-- SHIPPING ORIGINS
-- ============================================
INSERT INTO public.shipping_origins (id, name, code, description, is_active) VALUES
('0214bc6e-ba17-422a-b6da-5cc4a42beae2', 'China', 'CN', 'País de origen por defecto para productos mayoristas', true);

-- ============================================
-- TRANSIT HUBS
-- ============================================
INSERT INTO public.transit_hubs (id, name, code, description, is_active) VALUES
('a4710f6f-8af2-44f8-8983-436440e56d72', 'Miami, USA', 'US-FL', 'Hub de tránsito en Miami, Florida', true),
('ff805e65-1e84-461e-90a5-5f650c6656d3', 'Panamá', 'PA', 'Hub de tránsito en Panamá', false),
('17cc7dd2-b2b2-40b9-9a66-707aa19ea7b2', 'República Dominicana', 'DO', 'Hub de tránsito en República Dominicana', false);

-- ============================================
-- DESTINATION COUNTRIES
-- ============================================
INSERT INTO public.destination_countries (id, name, code, currency, is_active) VALUES
('b396647f-b9ed-44a9-aea9-4d4c9bf6249f', 'Haití', 'HT', 'HTG', true),
('dfa86b54-64e4-43dc-ac39-d2a0ca09e156', 'República Dominicana', 'DO', 'DOP', true),
('4749f1c5-95e7-4fc8-bcac-e9affeab6983', 'Jamaica', 'JM', 'JMD', true);

-- ============================================
-- SHIPPING ROUTES
-- ============================================
INSERT INTO public.shipping_routes (id, transit_hub_id, destination_country_id, is_direct, is_active) VALUES
('ea3d9dc1-d171-4da1-b41e-2f94997aad8c', 'a4710f6f-8af2-44f8-8983-436440e56d72', 'b396647f-b9ed-44a9-aea9-4d4c9bf6249f', false, true);

-- ============================================
-- ROUTE LOGISTICS COSTS
-- ============================================
INSERT INTO public.route_logistics_costs (id, shipping_route_id, segment, cost_per_kg, cost_per_cbm, min_cost, estimated_days_min, estimated_days_max, is_active) VALUES
('9f9ccf58-675a-422b-aab5-1bf00c913df9', 'ea3d9dc1-d171-4da1-b41e-2f94997aad8c', 'china_to_transit', 7.00, 0, 0, 7, 15, true),
('3de84e51-8515-4d90-9fd0-40cf83cda114', 'ea3d9dc1-d171-4da1-b41e-2f94997aad8c', 'transit_to_destination', 7.00, 0, 0, 3, 5, true);

-- ============================================
-- MARKETS
-- ============================================
INSERT INTO public.markets (id, name, code, destination_country_id, shipping_route_id, currency, timezone, is_active) VALUES
('7ff164cc-ae90-4ae2-8627-efde8b670bf8', 'Haiti', 'HT', 'b396647f-b9ed-44a9-aea9-4d4c9bf6249f', 'ea3d9dc1-d171-4da1-b41e-2f94997aad8c', 'USD', 'America/Port-au-Prince', true);

-- ============================================
-- MARKET PAYMENT METHODS
-- ============================================
INSERT INTO public.market_payment_methods (id, market_id, method_type, name, account_number, account_holder, bank_name, currency, is_active) VALUES
('dd8dcb91-596e-48c4-a329-70c3087fbbc1', '7ff164cc-ae90-4ae2-8627-efde8b670bf8', 'bank_transfer', 'Transferencia Bancaria', '5555555555555555', 'Stave Richard Dorvil', 'BBVA', 'USD', true);

-- ============================================
-- DEPARTMENTS (Haiti)
-- ============================================
INSERT INTO public.departments (id, name, code, is_active) VALUES
('074ae22d-d9e9-4194-b07e-01e4856964a4', 'Ouest', 'OU', true),
('f24bffbd-e6ea-4aa8-a509-58c70cbce97e', 'Artibonite', 'AR', true),
('cfbb6be9-e063-43da-8ce2-f79c9123ae78', 'Centre', 'CE', true),
('88a39643-2972-4fad-ab0c-b8f09136ada1', 'Nord-Est', 'NE', true),
('2ff18f76-3a20-4daf-b880-49e6081782db', 'Sud-Est', 'SE', true),
('831203bf-eac8-4f4d-b883-515447e87681', 'Nippes', 'NI', true),
('85ec8be9-d021-4fb2-8695-70ffdf600b3f', 'Sud', 'SD', true),
('0cae60fe-bcc4-4edb-9af2-d82b8df2b678', 'Nord', 'ND', true),
('e6cfbaa4-020f-492b-bc61-863fbedf439b', 'Nord-Ouest', 'NO', true),
('285868d9-50e5-45b2-aacf-820d17eadcfe', 'Grand''Anse', 'GA', true);

-- ============================================
-- COMMUNES (Sample - Ouest Department)
-- ============================================
INSERT INTO public.communes (id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, is_active) VALUES
('ba840085-86d1-4936-8b0a-58b2be941b72', 'Port-au-Prince', 'PV', '074ae22d-d9e9-4194-b07e-01e4856964a4', 2.50, 5.00, 2.00, 0, true),
('b08d0c92-a375-4b73-aa35-508acc50b339', 'Pétion-Ville', 'PT', '074ae22d-d9e9-4194-b07e-01e4856964a4', 2.75, 6.00, 2.00, 0, true),
('298f1217-cea1-4a3c-a5dd-5b2f19a7b85a', 'Delmas', 'DL', '074ae22d-d9e9-4194-b07e-01e4856964a4', 2.50, 5.50, 2.00, 0, true),
('cfb98efb-feb9-488c-99b4-6ab438cc0de0', 'Croix-des-Bouquets', 'CX', '074ae22d-d9e9-4194-b07e-01e4856964a4', 3.00, 7.00, 2.50, 2.00, true),
('a2f194d9-bcc0-470f-b675-27232da1af73', 'Carrefour', 'KF', '074ae22d-d9e9-4194-b07e-01e4856964a4', 2.75, 5.50, 2.00, 0, true);

-- Communes - Sud Department
INSERT INTO public.communes (id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, is_active) VALUES
('10b4110e-17b9-42f4-8cd7-3f8f9d69876e', 'Les Cayes', 'CA', '85ec8be9-d021-4fb2-8695-70ffdf600b3f', 3.00, 8.00, 3.00, 3.00, true),
('2cc4ef39-c650-434b-8258-b82f534ca651', 'Aquin', 'AQ', '85ec8be9-d021-4fb2-8695-70ffdf600b3f', 3.25, 9.00, 3.00, 3.50, true),
('fd77bbcc-8c5e-4030-a241-fc90cc5f02d5', 'Camp-Perrin', 'CM', '85ec8be9-d021-4fb2-8695-70ffdf600b3f', 3.50, 10.00, 3.50, 4.00, true);

-- Communes - Nord Department
INSERT INTO public.communes (id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, is_active) VALUES
('4bd37cd2-b534-4175-904e-14b0fa368a47', 'Cap-Haïtien', 'CP', '0cae60fe-bcc4-4edb-9af2-d82b8df2b678', 3.00, 7.00, 2.50, 3.00, true),
('ccc94287-ff96-4509-873f-289353b3085e', 'Limbé', 'LM', '0cae60fe-bcc4-4edb-9af2-d82b8df2b678', 3.25, 8.00, 3.00, 3.50, true),
('df375833-6e56-4993-aec4-5dcfc3244746', 'Grande-Rivière', 'GC', '0cae60fe-bcc4-4edb-9af2-d82b8df2b678', 3.50, 9.00, 3.00, 4.00, true);

-- Communes - Artibonite Department
INSERT INTO public.communes (id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, is_active) VALUES
('e2361773-f403-43be-92ab-8191b7ced3d1', 'Gonaïves', 'GN', 'f24bffbd-e6ea-4aa8-a509-58c70cbce97e', 2.75, 7.00, 2.50, 2.50, true),
('3e59cdab-134d-43ff-810a-8822a3742c8a', 'Saint-Marc', 'SM', 'f24bffbd-e6ea-4aa8-a509-58c70cbce97e', 2.75, 7.00, 2.50, 2.50, true),
('b6af32eb-2cc7-4822-b2da-ca5e529234e4', 'Dessalines', 'DS', 'f24bffbd-e6ea-4aa8-a509-58c70cbce97e', 3.00, 8.00, 3.00, 3.00, true);

-- Communes - Centre Department
INSERT INTO public.communes (id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, is_active) VALUES
('a20a8020-0005-4dfa-a2a4-77b60108e7e6', 'Hinche', 'HN', 'cfbb6be9-e063-43da-8ce2-f79c9123ae78', 3.25, 9.00, 3.00, 4.00, true),
('dc126ca3-fa6a-4d58-af04-ef0f066d8f1f', 'Mirebalais', 'MI', 'cfbb6be9-e063-43da-8ce2-f79c9123ae78', 3.00, 8.00, 3.00, 3.50, true);

-- ============================================
-- B2B MARGIN RANGES
-- ============================================
INSERT INTO public.b2b_margin_ranges (id, min_cost, max_cost, margin_percent, description, is_active, sort_order) VALUES
('ca3559d5-5bc7-4b58-bbee-f2f6768ea5aa', 0, 10, 300, 'Productos de bajo costo ($0-$10)', true, 1),
('c0d009e3-315a-4a83-a7fd-c9bbe9f6c83c', 10, 50, 30, 'Productos de costo medio ($10-$50)', true, 2),
('182f3a5e-3539-4de7-abb1-29374715874b', 50, NULL, 20, 'Productos de alto costo (>$50)', true, 3);

-- ============================================
-- SHIPPING RATES (General)
-- ============================================
INSERT INTO public.shipping_rates (id, key, value, description) VALUES
('985a8b4b-964f-44b8-b6e3-087ad929004a', 'china_usa_rate_per_kg', 7.20, 'Tarifa por kilogramo China-USA'),
('bdbbaf18-92e6-47fb-b692-5e73d3d90598', 'default_insurance_percent', 0.003, 'Porcentaje de seguro por defecto');

-- ============================================
-- PLATFORM SETTINGS
-- ============================================
INSERT INTO public.platform_settings (id, key, value, description) VALUES
('919dbc8e-c0f0-4932-a613-0398aa9cbbf8', 'po_consolidation_hours', '24', 'Horas entre ciclos de consolidación automática'),
('51387a74-280b-4f75-ab2b-062f1e746e5f', 'po_auto_close_enabled', '1', 'Habilitar cierre automático de PO');

-- ============================================
-- MARKETPLACE SECTION SETTINGS
-- ============================================
INSERT INTO public.marketplace_section_settings (id, section_key, title, description, is_enabled, sort_order, item_limit, display_mode, target_audience) VALUES
('109f0aca-6ae4-4a98-98fb-85a7dc3071a7', 'banners', 'Banners', 'Banners promocionales', true, 0, 5, 'carousel', 'all'),
('958b3832-5673-4f74-98f0-aa391ba13d04', 'featured_products', 'Productos Destacados', 'Productos destacados del catálogo', true, 1, 12, 'carousel', 'all'),
('2cab4799-1b02-4774-9a72-371b7637339a', 'best_sellers', 'Más Vendidos', 'Los productos más vendidos', true, 2, 12, 'carousel', 'all'),
('6cc4a1b0-b6c4-4683-88db-f2cd44d00501', 'new_arrivals', 'Recién Llegados', 'Productos recién añadidos', true, 3, 12, 'carousel', 'all'),
('12e7c278-25db-4118-9800-0ffe48b3149e', 'deals', 'Ofertas', 'Productos con descuento', true, 4, 12, 'carousel', 'all'),
('4bd539fb-25a8-4fdc-b019-f2dcb833b90f', 'top_stores', 'Tiendas Destacadas', 'Las mejores tiendas del marketplace', true, 5, 8, 'carousel', 'b2c'),
('538c577e-aa6b-4c8b-aed9-c9cf0e23ad06', 'recommended_products', 'Recomendados', 'Productos recomendados basados en tu navegación', true, 6, 8, 'carousel', 'all');

-- ============================================
-- CONSOLIDATION SETTINGS
-- ============================================
INSERT INTO public.consolidation_settings (id, consolidation_mode, order_quantity_threshold, time_interval_hours, notify_on_close, notify_threshold_percent, is_active) VALUES
('e7725c6b-a956-4553-a4b0-1ee2b9638643', 'hybrid', 50, 48, true, 80, true);

-- ============================================
-- CATEGORIES
-- ============================================
INSERT INTO public.categories (id, name, slug, is_visible_public, sort_order) VALUES
('bf49cba8-a789-476a-90e5-1941431efc68', 'Mujer', 'mujer', true, 1),
('7fc8aa86-52b9-44d5-90eb-97df6dd585ef', 'Curvy', 'curvy', true, 2),
('d5901ebb-b07e-465a-bed1-fcb44787bed6', 'Niños', 'ninos', true, 3),
('53855a0d-d33e-4ad0-837d-f9bf42259876', 'Hombre', 'hombre', true, 4),
('ac9f61c5-1e75-4af7-b008-a47d817c0e2d', 'Sweaters', 'sweaters', true, 5),
('c339cb0e-16d1-4412-a41d-24082fd03b8d', 'Celulares y Accs', 'celulares-y-accs', true, 6),
('4fe96233-cd51-4764-b517-5892b9e55a2b', 'Joyería y accs', 'joyeria-y-accs', true, 7),
('35e0367a-00ef-471f-a8c1-a83d67439e0c', 'Tops', 'tops', true, 8),
('ba666aed-b488-4e74-8d0a-0dde76e452de', 'Hogar y Vida', 'hogar-y-vida', true, 9),
('15bfe0cd-a437-4b2f-bcb3-648e333f0cb7', 'Belleza y salud', 'belleza-y-salud', true, 10),
('4021d9a9-f910-41cb-8682-b5badee48659', 'Zapatos', 'zapatos', true, 11),
('1ff0b38e-b44f-46d1-9fe6-3248a0ef9933', 'Deportes y Aire Libre', 'deportes-y-aire-libre', true, 12),
('82964d6b-78a7-4179-8385-1dc8db6895db', 'Automotriz', 'automotriz', true, 13),
('b23d7daf-6c34-4d86-b4a5-507a2ccead7a', 'Mezclilla', 'mezclilla', true, 14),
('cc065a8d-c16c-40dc-ac6a-e3e4e9d935b6', 'Ropa Interior y Pijamas', 'ropa-interior-y-pijamas', true, 15),
('453b90fb-8bba-4789-b055-2397c477eb15', 'Bebé y maternidad', 'bebe-y-maternidad', true, 16),
('abb67929-5770-431d-ac1d-c8724942e404', 'Vestidos', 'vestidos', true, 17),
('bc4db869-f70a-42c7-93bd-3789536000f1', 'Bottoms', 'bottoms', true, 18),
('811d7c5f-5894-4268-b2f7-529683f54b49', 'Abrigos y Trajes', 'abrigos-y-trajes', true, 19),
('5aae6db6-c0c7-484a-aea1-1f6b0c7a7474', 'Bolsas y Equipaje', 'bolsas-y-equipaje', true, 20),
('ba5e22ca-eb69-4185-8b49-48d39e9cd140', 'Útiles escolares y de oficina', 'utiles-escolares-y-oficina', true, 21),
('2ebfe615-aa42-4577-afe5-909d8359b587', 'Juguetes y juegos', 'juguetes-y-juegos', true, 22),
('2ba1bd50-8164-4d91-ba76-e06696e03676', 'Tecnología', 'tecnologia', true, 23),
('4550bb0a-b3c9-4d00-8aed-6920ce832ef1', 'Relojes', 'relojes', true, 24);

-- ============================================
-- ATTRIBUTES (EAV System)
-- ============================================
INSERT INTO public.attributes (id, name, slug, display_name, attribute_type, render_type, category_hint, is_active) VALUES
('8c0a07fc-77ff-436b-ad76-d02e7a029146', 'color', 'color', 'Color', 'color', 'swatches', 'fashion', true),
('879fe23d-b328-48be-aa0a-4c6bd3fcb1f1', 'size', 'size', 'size', 'size', 'buttons', 'fashion', true),
('7df36cee-a169-422e-a841-c92571e1d5c4', 'talla', 'talla', 'Talla', 'size', 'buttons', 'fashion', true);

-- ============================================
-- ATTRIBUTE OPTIONS (Colors)
-- ============================================
INSERT INTO public.attribute_options (id, attribute_id, value, display_value, color_hex, is_active) VALUES
('5de28f6a-00b0-4100-83f8-30f34749f289', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'blanco', 'Blanco', '#FFFFFF', true),
('74217db7-71ff-4861-9a60-7ff330a764a1', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'negro', 'Negro', '#000000', true),
('0f6348fd-56aa-46ee-bc37-4be669c28f84', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'red', 'Red', '#FF0000', true),
('2833c20b-3ad2-4ba7-aade-1217e1882063', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'blue', 'Blue', '#0000FF', true),
('501f4993-c418-46f9-9965-a1bc72cfd829', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'brown', 'Brown', '#8B4513', true),
('cb98f85c-99dd-4e4b-8a53-9c1c40fdc97a', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'rosa', 'Rosa', '#FFC0CB', true),
('69c66bbd-75ae-4f2a-a9c2-9d16d15c1ff9', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'verde_fruta', 'Verde Fruta', '#7CFC00', true),
('96e36a7a-4e77-40fd-9b37-7dd1a9f6f1ed', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'rojo', 'Rojo', '#FF0000', true),
('c36bb1ce-39ff-42c3-8b1f-f6c9a1f89cff', '8c0a07fc-77ff-436b-ad76-d02e7a029146', 'azul', 'Azul', '#0000FF', true);

-- ============================================
-- ATTRIBUTE OPTIONS (Sizes)
-- ============================================
INSERT INTO public.attribute_options (id, attribute_id, value, display_value, is_active) VALUES
('a45d6354-3a3f-4f37-bae2-f2ff89c71cac', '7df36cee-a169-422e-a841-c92571e1d5c4', 'm', 'M', true),
('ca4a8613-1386-4802-96e8-dbc9dbf87efd', '7df36cee-a169-422e-a841-c92571e1d5c4', 'l', 'L', true),
('ff21b3de-c642-4881-895d-f221e2ccd712', '7df36cee-a169-422e-a841-c92571e1d5c4', 'xl', 'XL', true),
('44cf8180-086c-4a08-bb9a-517c45605ecb', '7df36cee-a169-422e-a841-c92571e1d5c4', '2xl', '2XL', true),
('4983d8d2-61cc-48d7-ba76-359b5dc34bee', '7df36cee-a169-422e-a841-c92571e1d5c4', '3xl', '3XL', true),
('7b33cd94-add1-447d-9a46-c5efd46caf6f', '7df36cee-a169-422e-a841-c92571e1d5c4', '4xl', '4XL', true),
('5c0de1f8-5a8a-4c9f-b1e3-8a2c9d0e1f2a', '7df36cee-a169-422e-a841-c92571e1d5c4', 's', 'S', true);

-- Shoe sizes
INSERT INTO public.attribute_options (id, attribute_id, value, display_value, is_active) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7df36cee-a169-422e-a841-c92571e1d5c4', '39', '39', true),
('b2c3d4e5-f678-90ab-cdef-123456789012', '7df36cee-a169-422e-a841-c92571e1d5c4', '40', '40', true),
('c3d4e5f6-7890-abcd-ef12-345678901234', '7df36cee-a169-422e-a841-c92571e1d5c4', '41', '41', true),
('d4e5f678-90ab-cdef-1234-567890123456', '7df36cee-a169-422e-a841-c92571e1d5c4', '42', '42', true),
('e5f67890-abcd-ef12-3456-789012345678', '7df36cee-a169-422e-a841-c92571e1d5c4', '43', '43', true),
('f6789012-cdef-1234-5678-901234567890', '7df36cee-a169-422e-a841-c92571e1d5c4', '44', '44', true);

-- ============================================
-- END OF SEED DATA
-- ============================================
