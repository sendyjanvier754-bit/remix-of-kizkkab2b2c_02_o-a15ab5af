-- =====================================================
-- FIX: Prevent payment confirmation failures caused by NULL precio_venta
-- =====================================================
-- Root cause seen in production/local logs:
--   23502: null value in column "precio_venta" of relation "seller_catalog"
-- This happens inside inventory/catalog triggers executed during admin_confirm_payment.
--
-- Strategy:
-- 1) Add a defensive BEFORE trigger on seller_catalog
-- 2) Auto-fill precio_costo / precio_venta when missing
-- 3) Never allow NULL to reach NOT NULL constraints

CREATE OR REPLACE FUNCTION public.ensure_seller_catalog_prices_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalize metadata to object to avoid jsonb merge errors downstream
  IF NEW.metadata IS NULL OR jsonb_typeof(NEW.metadata) <> 'object' THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  -- Normalize images to array to avoid jsonb_array_length errors downstream
  IF NEW.images IS NULL OR jsonb_typeof(NEW.images) <> 'array' THEN
    NEW.images := '[]'::jsonb;
  END IF;

  -- Keep costo non-null whenever possible
  NEW.precio_costo := COALESCE(
    NEW.precio_costo,
    NEW.precio_b2b_base,
    0
  );

  -- Keep venta non-null; prefer margin over costo when available
  NEW.precio_venta := COALESCE(
    NEW.precio_venta,
    CASE
      WHEN COALESCE(NEW.precio_costo, 0) > 0 THEN ROUND((NEW.precio_costo * 1.30)::numeric, 2)
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.precio_b2b_base, 0) > 0 THEN ROUND((NEW.precio_b2b_base * 1.30)::numeric, 2)
      ELSE NULL
    END,
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_seller_catalog_prices_defaults ON public.seller_catalog;

CREATE TRIGGER trg_ensure_seller_catalog_prices_defaults
  BEFORE INSERT OR UPDATE ON public.seller_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_seller_catalog_prices_defaults();

ALTER FUNCTION public.ensure_seller_catalog_prices_defaults() SET search_path = public;
