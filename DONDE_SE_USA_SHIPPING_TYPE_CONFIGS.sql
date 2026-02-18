-- ============================================================================
-- RESUMEN: DÓNDE SE USA shipping_type_configs
-- ============================================================================

/*
CONTEXTO:
- shipping_type_configs es la tabla ANTIGUA que vincula tipos de envío a rutas
- shipping_tiers es la tabla NUEVA con estructura multi-tramo (China→USA, USA→Destino)
- El frontend YA usa shipping_tiers (useShippingTypes.ts)
- La función RPC todavía usa shipping_type_configs → CAUSA DEL ERROR

LUGARES DONDE SE USA shipping_type_configs:
*/

-- ============================================================================
-- 1. FUNCIÓN RPC: calculate_shipping_cost_cart
-- ============================================================================
-- ⚠️ CRÍTICO: Esta es la función que usa el carrito
-- Estado actual: Lee de shipping_type_configs (ANTIGUO)
-- Necesita: Actualizarse para leer de shipping_tiers (NUEVO)
-- Archivo de fix: FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql

SELECT 'calculate_shipping_cost_cart' as funcion,
       '⚠️ USA shipping_type_configs - NECESITA ACTUALIZACIÓN' as estado;

-- ============================================================================
-- 2. TIPOS DE SUPABASE (TypeScript)
-- ============================================================================
-- Archivo: src/integrations/supabase/types.ts
-- Impacto: BAJO - Solo definiciones de tipos
-- Acción: No requiere cambio inmediato (tipos autogenerados)

SELECT 'src/integrations/supabase/types.ts' as archivo,
       'ℹ️ Tipos autogenerados - No crítico' as estado;

-- ============================================================================
-- 3. VISTAS (si existen)
-- ============================================================================
-- Ver si hay vistas que usen shipping_type_configs

SELECT 
  'Vistas que usan shipping_type_configs' as info,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition LIKE '%shipping_type_configs%';

-- ============================================================================
-- 4. OTRAS FUNCIONES SQL
-- ============================================================================
-- Ver otras funciones que puedan usar la tabla

SELECT 
  'Funciones que usan shipping_type_configs' as info,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%shipping_type_configs%';

-- ============================================================================
-- 5. VERIFICAR SI HAY FOREIGN KEYS
-- ============================================================================
SELECT 
  'Foreign keys hacia shipping_type_configs' as info,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'shipping_type_configs'
  AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================================================
-- 6. VERIFICAR SI ALGUNA TABLA REFERENCIA shipping_type_configs
-- ============================================================================
SELECT 
  'Tablas con FK a shipping_type_configs' as info,
  conrelid::regclass AS tabla_origen,
  confrelid::regclass AS tabla_destino,
  conname AS constraint_name
FROM pg_constraint
WHERE confrelid = 'shipping_type_configs'::regclass
  AND contype = 'f';

-- ============================================================================
-- RESUMEN DE IMPACTO
-- ============================================================================
/*
CAMBIOS REQUERIDOS:

✅ CRÍTICO (BLOQUEA FUNCIONALIDAD):
1. calculate_shipping_cost_cart → Actualizar con FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql

⚠️ MEDIO (PUEDE CAUSAR ERRORES):
2. Vistas que usen shipping_type_configs → Verificar arriba y actualizar si existen
3. Otras funciones SQL → Verificar arriba y actualizar si existen

ℹ️ BAJO (NO CRÍTICO):
4. Tipos TypeScript → Se regeneran automáticamente
5. Archivos SQL de documentación/ejemplos → Solo referencia

PLAN DE ACCIÓN:
1. Ejecutar queries de arriba para ver vistas/funciones afectadas
2. Ejecutar FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql (CRÍTICO)
3. Actualizar vistas si existen
4. Actualizar otras funciones si existen
5. Regenerar tipos TypeScript (opcional): npx supabase gen types typescript
*/
