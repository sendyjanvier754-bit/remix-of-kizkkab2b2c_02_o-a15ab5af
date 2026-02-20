-- =============================================================================
-- 🎟️ TICKET #06: DDL - AGREGAR destination_country_id A ADDRESSES
-- =============================================================================
-- OBJETIVO: Agregar columna destination_country_id UUID a tabla addresses
-- Esta columna vinculará direcciones de usuarios con países de destino UUID
-- ESTADO: Listo para ejecutar
-- Tiempo estimado: 2 minutos
-- =============================================================================
-- 
-- PROBLEMA IDENTIFICADO:
-- ✅ addresses tiene country (TEXT) - valor: "Haití"
-- ❌ addresses NO tiene destination_country_id UUID
-- ✅ destination_countries tiene 4 países con UUID
-- 
-- SOLUCIÓN:
-- 1. Agregar columna destination_country_id UUID + FK a destination_countries
-- 2. Mapear "Haití" (TEXT) → UUID en destination_countries
-- 3. Hacer NOT NULL (según requerimiento de función)
-- 4. Crear índices para performance
--
-- =============================================================================

-- ✅ PASO 1: Agregar columna destination_country_id (FK a destination_countries)

ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS destination_country_id UUID
REFERENCES public.destination_countries(id) ON DELETE RESTRICT;

-- Confirmación: ver que se agregó
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'addresses' AND table_schema = 'public'
  AND column_name IN ('country', 'destination_country_id')
ORDER BY ordinal_position;

-- ✅ PASO 2: Ver qué UUIDs tenemos en destination_countries

SELECT 
  id,
  name,
  code,
  is_active
FROM public.destination_countries
ORDER BY name;

-- ✅ PASO 3: Mapear country (TEXT) → destination_country_id (UUID)
-- Buscar coincidencias exactas por nombre

UPDATE public.addresses a
SET destination_country_id = dc.id
FROM public.destination_countries dc
WHERE LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
  AND a.destination_country_id IS NULL;

-- Confirmación: ver cuántos se poblaron
SELECT 
  'Después de mapeo' as estado,
  COUNT(*) as total_addresses,
  COUNT(destination_country_id) as con_destination_country_id,
  COUNT(*) - COUNT(destination_country_id) as sin_destination_country_id
FROM public.addresses;

-- ✅ PASO 4: Ver qué no se pudo mapear (si hay)

SELECT 
  country,
  COUNT(*) as cantidad,
  COUNT(destination_country_id) as mapped,
  COUNT(*) - COUNT(destination_country_id) as unmapped
FROM public.addresses
GROUP BY country
ORDER BY cantidad DESC;

-- ✅ PASO 5: Crear índices para performance

CREATE INDEX IF NOT EXISTS idx_addresses_destination_country 
ON public.addresses(destination_country_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_destination_country 
ON public.addresses(user_id, destination_country_id);

-- Confirmación: ver índices creados
SELECT 
  indexname,
  tablename
FROM pg_indexes
WHERE tablename = 'addresses' AND indexname LIKE '%destination%';

-- ✅ PASO 6: Verificar integridad - cada address debe apuntar a país válido

SELECT 
  a.id,
  a.user_id,
  a.country as country_texto,
  a.destination_country_id,
  dc.name as country_uuid_name,
  dc.is_active
FROM public.addresses a
LEFT JOIN public.destination_countries dc ON a.destination_country_id = dc.id
LIMIT 10;

-- ✅ PASO 7: Hacer destination_country_id NOT NULL (si todos los registros están poblados)
-- ⚠️ SOLO SI: COUNT(destination_country_id) = COUNT(*) en PASO 4

-- ALTER TABLE public.addresses 
-- ALTER COLUMN destination_country_id SET NOT NULL;

-- =============================================================================
-- 📋 VALIDACIÓN ESPERADA (Responde después de ejecutar):
-- =============================================================================
-- ✅ PASO 1: Se agregó columna destination_country_id (UUID, nullable)
-- ✅ PASO 2: Ver 4 países en destination_countries (UUID + nombre)
-- ✅ PASO 3: Mapeo automático de country TEXT → UUID
-- ✅ PASO 4: ¿Cuántos addresses se poblaron? (debería ser 1, el único registro)
-- ✅ PASO 5: Índices creados exitosamente
-- ✅ PASO 6: address apunta correctamente a país UUID
--
-- CONFIRMACIÓN (responde al asistente):
-- 1. ¿Se agregó la columna destination_country_id? (SÍ / NO)
-- 2. ¿Cuántos addresses se poblaron con UUID? (debería ser 1)
-- 3. ¿El address apunta al país correcto? (Haití → UUID)
-- 4. ¿Algún error o problema? (SÍ / NO)
-- =============================================================================
