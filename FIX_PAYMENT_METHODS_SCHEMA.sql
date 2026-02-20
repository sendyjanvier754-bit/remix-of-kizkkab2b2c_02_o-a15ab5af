-- =============================================================================
-- FIX: payment_methods — align DB schema with code
-- PROBLEMAS encontrados:
--   1. owner_id NOT NULL → admin envía NULL → 400 error
--   2. name NOT NULL → código no envía 'name' → insert fails
--   3. Faltan columnas: phone_number, holder_name, metadata
-- =============================================================================

-- PASO 1: Hacer owner_id nullable (admins no tienen owner)
ALTER TABLE public.payment_methods
  ALTER COLUMN owner_id DROP NOT NULL;

-- PASO 2: Hacer name nullable (se usa display_name en su lugar)
ALTER TABLE public.payment_methods
  ALTER COLUMN name DROP NOT NULL;

-- PASO 3: Agregar columnas faltantes
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS phone_number   TEXT,
  ADD COLUMN IF NOT EXISTS holder_name    TEXT,
  ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS account_type   TEXT,
  ADD COLUMN IF NOT EXISTS bank_swift     TEXT,
  ADD COLUMN IF NOT EXISTS display_name   TEXT,
  ADD COLUMN IF NOT EXISTS manual_enabled    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS automatic_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS destination_country_id UUID REFERENCES public.destination_countries(id) ON DELETE SET NULL;

-- PASO 4: Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- PASO 5: Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods'
ORDER BY ordinal_position;
