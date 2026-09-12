-- Permite activar la tienda destacada por un periodo o indefinidamente.
ALTER TABLE public.trending_store_selection
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.trending_store_selection.expires_at IS
  'NULL significa que la tienda destacada permanece activa indefinidamente.';
