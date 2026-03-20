-- =============================================================================
-- Migration: Create upgrade_to_seller RPC function
-- Fixes: "new row violates row-level security policy for table user_roles"
-- 
-- Problem: The frontend was trying to directly INSERT/DELETE on user_roles,
-- but RLS only allows admins to manage roles. Regular users are blocked.
--
-- Solution: A SECURITY DEFINER function that runs with elevated privileges
-- and handles the full seller upgrade flow atomically.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upgrade_to_seller(
  p_store_name TEXT,
  p_store_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_role app_role;
  v_store_id UUID;
  v_seller_id UUID;
  v_slug TEXT;
  v_attempts INT := 0;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input
  IF TRIM(COALESCE(p_store_name, '')) = '' THEN
    RAISE EXCEPTION 'Store name is required';
  END IF;

  -- Sanitize store name length
  p_store_name := LEFT(TRIM(p_store_name), 80);
  p_store_description := LEFT(TRIM(COALESCE(p_store_description, 'Tienda de ' || p_store_name)), 300);

  -- 3. Check current role - prevent admin/seller from re-upgrading
  SELECT role INTO v_current_role
  FROM user_roles
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_role = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot downgrade to seller via this function';
  END IF;

  IF v_current_role = 'seller' THEN
    -- Already a seller, just return success with existing store
    SELECT id INTO v_store_id FROM stores WHERE owner_user_id = v_user_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'store_id', v_store_id, 'message', 'Already a seller');
  END IF;

  -- 4. Delete existing user role and insert seller role (atomic)
  DELETE FROM user_roles WHERE user_id = v_user_id;
  
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'seller');

  -- 5. Generate unique store slug (K + 10 hex + year)
  LOOP
    v_slug := 'K' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)) 
              || TO_CHAR(NOW(), 'YY');
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM stores WHERE slug = v_slug) THEN
      EXIT;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique slug after 10 attempts';
    END IF;
  END LOOP;

  -- 6. Check if store already exists (maybe trigger created it)
  SELECT id INTO v_store_id FROM stores WHERE owner_user_id = v_user_id LIMIT 1;
  
  IF v_store_id IS NOT NULL THEN
    -- Update existing store with user's chosen name
    UPDATE stores 
    SET name = p_store_name, 
        description = p_store_description
    WHERE id = v_store_id;
  ELSE
    -- Create the store
    INSERT INTO stores (owner_user_id, name, description, slug, is_active, is_accepting_orders, show_stock, country)
    VALUES (v_user_id, p_store_name, p_store_description, v_slug, true, true, true, 'Haiti')
    RETURNING id INTO v_store_id;
  END IF;

  -- 7. Create seller record if not exists
  SELECT id INTO v_seller_id FROM sellers WHERE user_id = v_user_id LIMIT 1;
  
  IF v_seller_id IS NULL THEN
    INSERT INTO sellers (user_id, email, name, business_name, is_verified)
    SELECT v_user_id, 
           COALESCE((SELECT email FROM auth.users WHERE id = v_user_id), ''),
           p_store_name,
           p_store_name,
           false
    RETURNING id INTO v_seller_id;
  END IF;

  -- 8. Init onboarding progress
  INSERT INTO seller_onboarding_progress (user_id, steps_completed, current_step, is_complete)
  VALUES (v_user_id, '{"store_info": true}'::JSONB, 'social_media', false)
  ON CONFLICT (user_id) DO UPDATE SET
    steps_completed = EXCLUDED.steps_completed,
    current_step = EXCLUDED.current_step;

  RETURN jsonb_build_object(
    'success', true,
    'store_id', v_store_id,
    'seller_id', v_seller_id,
    'message', 'Seller account created successfully'
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upgrade_to_seller(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- Function: cancel_seller_registration
-- Reverts a seller back to regular user if they cancel during onboarding.
-- Only works if onboarding is NOT complete (safety check).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_seller_registration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_complete BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow cancellation if onboarding is incomplete
  SELECT is_complete INTO v_is_complete
  FROM seller_onboarding_progress
  WHERE user_id = v_user_id;

  IF v_is_complete IS TRUE THEN
    RAISE EXCEPTION 'Cannot cancel: onboarding already completed. Contact support.';
  END IF;

  -- Revert role to user
  DELETE FROM user_roles WHERE user_id = v_user_id;
  INSERT INTO user_roles (user_id, role) VALUES (v_user_id, 'user');

  -- Clean up onboarding progress
  DELETE FROM seller_onboarding_progress WHERE user_id = v_user_id;

  -- Deactivate seller record (don't delete, keep for audit)
  UPDATE sellers SET is_active = false WHERE user_id = v_user_id;

  -- Deactivate store (don't delete)
  UPDATE stores SET is_active = false WHERE owner_user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Seller registration cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_seller_registration() TO authenticated;
