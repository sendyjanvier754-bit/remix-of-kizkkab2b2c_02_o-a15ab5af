-- =============================================================================
-- 🎟️ TICKET #01: DESCUBRIMIENTO ESTRUCTURAL
-- =============================================================================
-- OBJETIVO: Descubrir QUÉ TABLAS REALMENTE EXISTEN (sin asumir nada)
-- ESTADO: Listo para ejecutar
-- Tiempo estimado: 30 segundos
-- =============================================================================

-- ✅ PASO 1: Listar TODAS las tablas públicas
SELECT 
  table_name,
  CASE 
    WHEN table_name LIKE '%cart%' THEN '🛒 Carrito'
    WHEN table_name LIKE '%product%' THEN '📦 Producto'
    WHEN table_name LIKE '%order%' THEN '📋 Orden'
    WHEN table_name LIKE '%shipping%' OR table_name LIKE '%route%' OR table_name LIKE '%envio%' THEN '🚚 Logística'
    WHEN table_name LIKE '%user%' OR table_name LIKE '%auth%' THEN '👤 Usuario'
    WHEN table_name LIKE '%country%' OR table_name LIKE '%pais%' OR table_name LIKE '%market%' THEN '🌍 Geografía'
    WHEN table_name LIKE '%seller%' OR table_name LIKE '%vendor%' THEN '🏪 Vendedor'
    ELSE '📊 Otros'
  END as categoria,
  (
    SELECT COUNT(*)::TEXT 
    FROM information_schema.columns 
    WHERE table_schema = t.table_schema 
    AND table_name = t.table_name
  ) as columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY categoria, table_name;

-- ✅ PASO 2: Contar registros en CADA tabla
SELECT 
  table_name,
  (SELECT COUNT(*)::TEXT FROM information_schema.columns c WHERE c.table_name = t.table_name) as num_columnas
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ✅ PASO 3: Verificar tablas de Logística específicamente

-- Existe SHIPPING_ROUTES?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_routes') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as shipping_routes_existe;

-- Existe ROUTE_LOGISTICS_COSTS?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'route_logistics_costs') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as route_logistics_costs_existe;

-- Existe SHIPPING_TIERS?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_tiers') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as shipping_tiers_existe;

-- Existe SHIPPING_ADDRESSES?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_addresses') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as shipping_addresses_existe;

-- Existe DESTINATION_COUNTRIES?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'destination_countries') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as destination_countries_existe;

-- Existe MARKETS?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'markets') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as markets_existe;

-- Existe B2B_CART_ITEMS?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'b2b_cart_items') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as b2b_cart_items_existe;

-- Existe PRODUCTS?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as products_existe;

-- =============================================================================
-- 📋 VALIDACIÓN ESPERADA:
-- =============================================================================
-- ✅ Ver lista completa de tablas
-- ✅ Identificar cuáles son de logística
-- ✅ Ver cuáles existen (✅) y cuáles no (❌)
-- 
-- CONFIRMACIÓN (responde al asistente):
-- 1. ¿Cuáles tablas de LOGÍSTICA existen?
-- 2. ¿Cuáles FALTAN?
-- 3. ¿Hay tabla alternativa para SHIPPING_ADDRESSES (ej: user_addresses)?
-- =============================================================================
