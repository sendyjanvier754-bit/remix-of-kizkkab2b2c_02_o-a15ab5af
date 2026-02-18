-- ============================================================================
-- ✅ AGREGAR NOMBRES PERSONALIZADOS A SHIPPING_ROUTES
-- ============================================================================

-- 1. Agregar columnas para nombres personalizados
ALTER TABLE public.shipping_routes
ADD COLUMN IF NOT EXISTS route_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS origin_country VARCHAR(255) DEFAULT 'China',
ADD COLUMN IF NOT EXISTS destination_country VARCHAR(255);

-- 2. Generar nombres automáticos para rutas existentes basados en destination_countries
UPDATE public.shipping_routes sr
SET 
  origin_country = 'China',
  destination_country = COALESCE(dc.name, 'Destino'),
  route_name = 'China → ' || COALESCE(dc.name, 'Destino')
FROM public.destination_countries dc
WHERE sr.destination_country_id = dc.id
  AND (sr.route_name IS NULL OR sr.destination_country IS NULL);

-- 3. Para rutas sin destination_country_id, usar nombre genérico
UPDATE public.shipping_routes
SET 
  origin_country = 'China',
  destination_country = 'Destino',
  route_name = 'Ruta ' || substring(id::text, 1, 8)
WHERE route_name IS NULL;

-- ============================================================================
-- ✅ RESTRICCIÓN: UNA RUTA SOLO PUEDE TENER UN TIPO DE ENVÍO
-- ============================================================================

-- 4. Eliminar constraint anterior si existe
ALTER TABLE public.shipping_tiers 
DROP CONSTRAINT IF EXISTS unique_route_tier;

-- 5. Eliminar constraint actual si existe (para poder recrearlo)
ALTER TABLE public.shipping_tiers
DROP CONSTRAINT IF EXISTS unique_one_tier_per_route;

-- 6. Agregar nuevo constraint: UN SOLO tier por ruta
ALTER TABLE public.shipping_tiers
ADD CONSTRAINT unique_one_tier_per_route UNIQUE(route_id);

-- Nota: Esto significa que route_id solo puede aparecer UNA VEZ en shipping_tiers
-- Si necesitas Standard Y Express, tendrías que crear 2 rutas diferentes

-- ============================================================================
-- 📊 VERIFICACIÓN
-- ============================================================================

-- Ver rutas con nombres actualizados
SELECT 
  '✅ Rutas con nombres personalizados' as info,
  id,
  route_name,
  origin_country,
  destination_country,
  is_direct,
  is_active
FROM public.shipping_routes
ORDER BY created_at DESC;

-- Ver estructura actualizada
SELECT 
  '📋 Columnas de shipping_routes' as info,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_routes'
  AND column_name IN ('route_name', 'origin_country', 'destination_country')
ORDER BY ordinal_position;

-- Ver constraint de único tier por ruta
SELECT 
  '🔒 Constraint de una ruta = un tier' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
  AND constraint_name = 'unique_one_tier_per_route';

-- Verificar cuántos tiers tiene cada ruta
SELECT 
  '📊 Tiers por ruta' as info,
  sr.route_name,
  sr.destination_country,
  COUNT(st.id) as cantidad_tiers,
  string_agg(st.tier_type, ', ') as tipos
FROM public.shipping_routes sr
LEFT JOIN public.shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.id, sr.route_name, sr.destination_country
ORDER BY sr.route_name;

-- ============================================================================
-- ⚠️ IMPORTANTE: MIGRACIÓN DE DATOS EXISTENTES
-- ============================================================================

/*
Si actualmente tienes rutas con MÚLTIPLES tiers (Standard Y Express),
necesitas:

1. Identificar rutas con múltiples tiers:
*/

SELECT 
  '⚠️ Rutas con múltiples tiers (CONFLICTO)' as alerta,
  sr.id as route_id,
  sr.route_name,
  COUNT(st.id) as cantidad_tiers,
  string_agg(st.tier_type || ' (' || st.transport_type || ')', ', ') as tiers
FROM public.shipping_routes sr
JOIN public.shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.id, sr.route_name
HAVING COUNT(st.id) > 1;

/*
2. Para resolver conflictos, tienes 2 opciones:

OPCIÓN A: Duplicar rutas (una para Standard, otra para Express)
-----------------------------------------------------------------
-- Ejemplo manual:
INSERT INTO public.shipping_routes (
  destination_country_id, 
  transit_hub_id, 
  is_direct, 
  is_active,
  route_name,
  origin_country,
  destination_country
)
SELECT 
  destination_country_id,
  transit_hub_id,
  is_direct,
  is_active,
  route_name || ' - Express',
  origin_country,
  destination_country
FROM public.shipping_routes
WHERE id = 'ruta_con_multiples_tiers_id';

-- Luego actualiza el tier Express para usar la nueva ruta:
UPDATE public.shipping_tiers
SET route_id = 'nueva_ruta_id'
WHERE tier_type = 'express' AND route_id = 'ruta_original_id';

OPCIÓN B: Mantener solo un tier por ruta (eliminar los demás)
-----------------------------------------------------------------
-- Ejemplo: Mantener solo Standard, eliminar Express
DELETE FROM public.shipping_tiers
WHERE tier_type = 'express' 
  AND route_id = 'ruta_id';

*/

-- ============================================================================
-- 📝 RESUMEN DE CAMBIOS
-- ============================================================================

/*
✅ Cambios aplicados:

1. shipping_routes ahora tiene:
   - route_name (nombre personalizable)
   - origin_country (origen, default "China")
   - destination_country (destino, autogenerado desde destination_countries)

2. shipping_tiers tiene constraint:
   - UNIQUE(route_id) = Una ruta solo puede tener UN tier
   - Si necesitas Standard Y Express, crea 2 rutas separadas

3. Frontend actualizado para:
   - Editar nombre de rutas
   - Mostrar nombres personalizados
   - Advertir sobre restricción de un tier por ruta

📍 Próximos pasos:
1. Ejecutar este SQL
2. Verificar si hay conflictos (rutas con múltiples tiers)
3. Resolver conflictos (duplicar rutas o eliminar tiers extra)
4. Actualizar frontend para editar route_name
*/
