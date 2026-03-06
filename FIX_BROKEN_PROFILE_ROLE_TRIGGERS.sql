-- ============================================================================
-- FIX STEP 2: Fix the 3 remaining functions that reference profiles.role
-- Run this AFTER the first script (DROP triggers) completed successfully
-- ============================================================================

-- Fix auto_create_seller_on_role_insert: remove the profiles.role reference
-- (already created by migration 20260306044241 - just remove any profiles.role update)
CREATE OR REPLACE FUNCTION public.auto_create_seller_on_role_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_store_name TEXT;
  v_full_name TEXT;
BEGIN
  IF NEW.role IN ('seller', 'admin') THEN
    IF NOT EXISTS (SELECT 1 FROM sellers WHERE user_id = NEW.user_id) THEN
      SELECT full_name INTO v_full_name FROM profiles WHERE id = NEW.user_id;
      SELECT id, name INTO v_store_id, v_store_name
      FROM stores WHERE owner_user_id = NEW.user_id LIMIT 1;

      INSERT INTO sellers (
        user_id, store_id, business_name, business_type,
        is_verified, verification_status, commission_rate, is_active
      ) VALUES (
        NEW.user_id,
        v_store_id,
        COALESCE(v_store_name, v_full_name, 'Vendedor'),
        'retail',
        CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
        CASE WHEN NEW.role = 'admin' THEN 'verified'::verification_status ELSE 'pending_verification'::verification_status END,
        10.00,
        true
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix auto_create_seller_from_store: remove any profiles.role update/read
CREATE OR REPLACE FUNCTION public.auto_create_seller_from_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  -- Create a seller record when a new store is created
  IF NOT EXISTS (SELECT 1 FROM sellers WHERE user_id = NEW.owner_user_id) THEN
    SELECT full_name INTO v_full_name FROM profiles WHERE id = NEW.owner_user_id;

    INSERT INTO sellers (
      user_id, store_id, business_name, business_type,
      is_verified, verification_status, commission_rate, is_active
    ) VALUES (
      NEW.owner_user_id,
      NEW.id,
      COALESCE(NEW.name, v_full_name, 'Vendedor'),
      'retail',
      false,
      'pending_verification'::verification_status,
      10.00,
      true
    )
    ON CONFLICT (user_id) DO UPDATE SET
      store_id = EXCLUDED.store_id,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix sync_missing_profiles_and_roles: rewrite without profiles.role
-- Must DROP first because return type conflicts with original definition
DROP FUNCTION IF EXISTS public.sync_missing_profiles_and_roles() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_missing_profiles_and_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure every auth user has a profile
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    NOW(),
    NOW()
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure every user has at least the 'user' role in user_roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT p.id, 'user'
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
  )
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Verify: check for actual profiles.role column access patterns
-- (profiles.role, profiles SET role, profiles r WHERE r.role, etc.)
SELECT
  p.proname AS function_name,
  CASE
    WHEN pg_get_functiondef(p.oid) ~* 'profiles\s*\.\s*role'
      OR pg_get_functiondef(p.oid) ~* 'profiles\s+\w+\s+SET\s+role'
      OR pg_get_functiondef(p.oid) ~* 'UPDATE\s+profiles\s+SET.*role'
      THEN '❌ STILL REFERENCES profiles.role'
    ELSE '✅ OK - no profiles.role column access'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prokind = 'f'
  AND n.nspname = 'public'
  AND p.proname IN (
    'auto_create_seller_on_role_insert',
    'auto_create_seller_from_store',
    'sync_missing_profiles_and_roles'
  );

