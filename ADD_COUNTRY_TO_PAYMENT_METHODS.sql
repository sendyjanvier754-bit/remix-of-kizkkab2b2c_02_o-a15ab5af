-- ============================================================
-- MIGRACIÓN: Agregar destination_country_id a payment_methods
-- Cada método de pago se configura por país destino
-- ============================================================

-- ============================================================
-- PASO 1: Agregar columna destination_country_id
-- ============================================================
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS destination_country_id UUID REFERENCES public.destination_countries(id) ON DELETE SET NULL;

-- ============================================================
-- PASO 2: Índice para búsqueda por país
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payment_methods_country
  ON public.payment_methods(destination_country_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_owner_country
  ON public.payment_methods(owner_type, destination_country_id);
