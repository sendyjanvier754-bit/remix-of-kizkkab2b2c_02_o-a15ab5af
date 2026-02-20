-- =============================================================================
-- 🎟️ TICKET #07: TRIGGER AUTOMÁTICO - destination_country_id
-- =============================================================================
-- OBJETIVO: Crear trigger automático que llene destination_country_id
-- basado en el country TEXT que proporciona el usuario
-- PATRÓN: Automático por defecto + Manual override permitido
-- ESTADO: Listo para ejecutar (DEPENDE de TICKET #06)
-- Tiempo estimado: 3 minutos
-- =============================================================================
--
-- LÓGICA:
-- 1. Si destination_country_id es NULL → busca automáticamente por país
-- 2. Si destination_country_id viene en INSERT/UPDATE → respeta el valor (override)
-- 3. Validación: destination_country_id debe existir en destination_countries
-- 4. Fallback: Si no encuentra país que coincida → deja NULL (será error en BD)
--
-- =============================================================================

-- ✅ PASO 1: Crear función que llene destination_country_id automáticamente

CREATE OR REPLACE FUNCTION public.fn_addresses_set_destination_country()
RETURNS TRIGGER AS $$
DECLARE
  v_country_id UUID;
BEGIN
  -- Si destination_country_id NO viene en el INSERT/UPDATE
  -- (es decir, está NULL), buscamos automáticamente
  IF NEW.destination_country_id IS NULL THEN
    -- Intentar buscar país por coincidencia de nombre
    SELECT id INTO v_country_id
    FROM public.destination_countries
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.country))
      AND is_active = true
    LIMIT 1;
    
    -- Si encontramos coincidencia, asignamos
    IF v_country_id IS NOT NULL THEN
      NEW.destination_country_id := v_country_id;
    END IF;
    -- Si no encontramos → deixamos NULL (la FK constraint lo validará)
  END IF;
  -- Si destination_country_id viene populated → respetamos (manual override)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Confirmación: función creada
SELECT 
  routine_name,
  routine_type,
  routine_body
FROM information_schema.routines
WHERE routine_name = 'fn_addresses_set_destination_country'
  AND routine_schema = 'public';

-- ✅ PASO 2: Crear trigger que ejecuta la función ANTES de INSERT o UPDATE

CREATE TRIGGER trg_addresses_set_destination_country
BEFORE INSERT OR UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.fn_addresses_set_destination_country();

-- Confirmación: trigger creado
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_addresses_set_destination_country'
  AND trigger_schema = 'public';

-- ✅ PASO 3: Verificar que el trigger funciona - HACER NOT NULL

-- Una vez confirmado que TICKET #06 pobló todos los registros,
-- hacemos la columna NOT NULL para garantizar que siempre hay país

ALTER TABLE public.addresses
ALTER COLUMN destination_country_id SET NOT NULL;

-- Confirmación: es NOT NULL ahora
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'addresses' AND table_schema = 'public'
  AND column_name = 'destination_country_id';

-- ✅ PASO 4: Probar inserción automática con trigger
-- (Descomentar SOLO para testing - esto agrega una dirección de prueba)

/*
INSERT INTO public.addresses (
  user_id,
  label,
  full_name,
  phone,
  street_address,
  city,
  country,
  postal_code
) VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, -- reemplazar con user_id real
  'Test Automático',
  'Test User',
  '+1-555-0123',
  '123 Test Street',
  'Test City',
  'Haití',  -- <-- El trigger debe llenar destination_country_id automáticamente
  '00000'
)
RETURNING id, country, destination_country_id;

-- Ver el resultado
SELECT id, country, destination_country_id, (
  SELECT name FROM destination_countries WHERE id = destination_country_id
) as destination_country_name
FROM addresses
ORDER BY created_at DESC
LIMIT 1;
*/

-- ✅ PASO 5: Verificar integridad final - todos los addresses tienen país

SELECT 
  'Final Validation' as estado,
  COUNT(*) as total_addresses,
  COUNT(destination_country_id) as con_destination_country_id,
  COUNT(*) - COUNT(destination_country_id) as sin_destination_country_id,
  CASE 
    WHEN COUNT(*) = COUNT(destination_country_id) THEN '✅ OK'
    ELSE '❌ PROBLEMA'
  END as resultado
FROM public.addresses;

-- ✅ PASO 6: Ver todas las direcciones con su país asignado

SELECT 
  a.id,
  a.user_id,
  a.full_name,
  a.city,
  a.country as country_texto,
  a.destination_country_id,
  dc.name as destination_country_name,
  dc.code as destination_country_code,
  dc.is_active
FROM public.addresses a
LEFT JOIN public.destination_countries dc ON a.destination_country_id = dc.id
ORDER BY a.created_at DESC;

-- ✅ PASO 7: Validar que no haya orphaned records (direcciones sin país válido)

SELECT 
  a.id,
  a.country as country_texto,
  a.destination_country_id,
  CASE 
    WHEN dc.id IS NULL THEN '❌ ORPHANED (no existe en destination_countries)'
    WHEN dc.is_active = false THEN '⚠️ INACTIVO'
    ELSE '✅ OK'
  END as status
FROM public.addresses a
LEFT JOIN public.destination_countries dc ON a.destination_country_id = dc.id;

-- =============================================================================
-- 📋 VALIDACIÓN ESPERADA (Responde después de ejecutar):
-- =============================================================================
-- ✅ PASO 1: Función fn_addresses_set_destination_country creada
-- ✅ PASO 2: Trigger trg_addresses_set_destination_country creado
-- ✅ PASO 3: Columna destination_country_id ahora es NOT NULL
-- ✅ PASO 4: Inserción de prueba funciona (si descomenta)
-- ✅ PASO 5: Todos los addresses tienen destination_country_id poblado
-- ✅ PASO 6: Puedes ver país nombre + código para cada dirección
-- ✅ PASO 7: No hay orphaned records (integridad garantizada)
--
-- CONFIRMACIÓN (responde al asistente):
-- 1. ¿Se creó la función fn_addresses_set_destination_country? (SÍ / NO)
-- 2. ¿Se creó el trigger trg_addresses_set_destination_country? (SÍ / NO)
-- 3. ¿La columna destination_country_id es NOT NULL ahora? (SÍ / NO)
-- 4. ¿Todos los addresses tienen destination_country_id? (SÍ / NO)
-- 5. ¿Algún error o problema? (SÍ / NO)
-- =============================================================================
