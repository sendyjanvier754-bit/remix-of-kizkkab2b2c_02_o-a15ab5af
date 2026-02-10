-- ============================================================
-- FIX: Ensure automatic store PLACEHOLDER creation for sellers
-- ============================================================
-- This migration creates empty store placeholders when a seller role is assigned
-- Seller MUST complete the store configuration via SellerOnboardingPage
-- Store becomes active (is_active = true) ONLY after seller configures it

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_seller_role_assigned ON public.user_roles;
DROP FUNCTION IF EXISTS public.handle_seller_store_creation();

-- 2. Create improved function that creates EMPTY store placeholders
CREATE OR REPLACE FUNCTION public.handle_seller_store_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_existing_store UUID;
  v_store_slug TEXT;
BEGIN
  -- Only proceed for seller role
  IF NEW.role != 'seller' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;

  -- Check if store already exists for this user (prevent duplicates)
  SELECT id INTO v_existing_store
  FROM public.stores
  WHERE owner_user_id = v_user_id
  LIMIT 1;

  -- If store exists, skip creation (idempotent)
  IF v_existing_store IS NOT NULL THEN
    RAISE LOG 'Store already exists for user %, skipping creation', v_user_id;
    RETURN NEW;
  END IF;

  -- Generate unique slug with format: KZ + 6 random digits + creation year (no hyphen)
  v_store_slug := 'KZ' || SUBSTRING(CAST(FLOOR(RANDOM() * 999999 + 100000) AS TEXT), 1, 6) || 
                  EXTRACT(YEAR FROM NOW())::TEXT;

  -- Create EMPTY store placeholder
  -- Seller MUST complete the configuration via SellerOnboardingPage
  -- Store is INACTIVE until seller configures it
  INSERT INTO public.stores (
    owner_user_id,
    name,
    slug,
    description,
    logo,
    is_active,
    is_accepting_orders,
    show_stock,
    country
  ) VALUES (
    v_user_id,
    NULL,  -- No name - seller must configure
    v_store_slug,
    NULL,  -- No description - seller must configure
    NULL,  -- No logo - seller must configure
    false, -- INACTIVE until seller configures
    true,
    true,
    'Haiti'
  );

  RAISE LOG 'Created empty store placeholder for seller %', v_user_id;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating store placeholder for user %: %', v_user_id, SQLERRM;
  -- Don't fail the transaction, just log the error
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create trigger on user_roles INSERT
CREATE TRIGGER on_seller_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seller_store_creation();

-- 4. Ensure all existing sellers have store placeholders (if missing)
INSERT INTO public.stores (owner_user_id, name, slug, description, logo, is_active, is_accepting_orders, show_stock, country)
SELECT 
  ur.user_id,
  NULL,
  'KZ' || SUBSTRING(LPAD(CAST(ABS(HASHTEXT(ur.user_id::text)) % 900000 + 100000 AS TEXT), 6, '0'), 1, 6) || EXTRACT(YEAR FROM NOW())::TEXT,
  NULL,
  NULL,
  false,
  true,
  true,
  'Haiti'
FROM public.user_roles ur
WHERE ur.role = 'seller'
AND NOT EXISTS (
  SELECT 1 FROM public.stores s WHERE s.owner_user_id = ur.user_id
);

-- 5. Log results
DO $$
DECLARE
  v_total_sellers INTEGER;
  v_stores_with_config INTEGER;
  v_stores_inactive INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_total_sellers
  FROM public.user_roles ur
  WHERE ur.role = 'seller';
  
  SELECT COUNT(*)
  INTO v_stores_with_config
  FROM public.stores s
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = s.owner_user_id
    AND ur.role = 'seller'
  )
  AND s.name IS NOT NULL;
  
  SELECT COUNT(*)
  INTO v_stores_inactive
  FROM public.stores s
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = s.owner_user_id
    AND ur.role = 'seller'
  )
  AND s.is_active = false;
  
  RAISE LOG 'Migration complete: % total sellers, % with configured stores, % inactive',
    v_total_sellers, v_stores_with_config, v_stores_inactive;
END $$;

-- 6. Update all existing UUID slugs to KZ format
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.stores
  SET slug = 'KZ' || SUBSTRING(CAST(ABS(HASHTEXT(id::text)) % 900000 + 100000 AS TEXT), 1, 6) || EXTRACT(YEAR FROM NOW())::TEXT
  WHERE slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = stores.owner_user_id
    AND ur.role = 'seller'
  );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE LOG 'Updated % existing store slugs to KZ format', v_updated_count;
END $$;

COMMIT;
-- 7. Force update all seller store slugs to KZ format (regardless of previous format)
DO $$
DECLARE
  v_forced_count INTEGER;
BEGIN
  UPDATE public.stores
  SET slug = 'KZ' || SUBSTRING(CAST(ABS(HASHTEXT(id::text)) % 900000 + 100000 AS TEXT), 1, 6) || EXTRACT(YEAR FROM NOW())::TEXT
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = stores.owner_user_id
    AND ur.role = 'seller'
  );
  GET DIAGNOSTICS v_forced_count = ROW_COUNT;
  RAISE LOG 'Forced update: % seller store slugs set to KZ format', v_forced_count;
END $$;
