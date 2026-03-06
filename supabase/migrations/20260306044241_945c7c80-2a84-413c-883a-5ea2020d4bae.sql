-- ============================================================================
-- SECURITY FIX: Migrate policies from profiles.role to user_roles table
-- and drop the redundant profiles.role column
-- ============================================================================

-- 1. Drop the trigger that depends on profiles.role
DROP TRIGGER IF EXISTS trigger_auto_create_seller_on_role_change ON profiles;
DROP FUNCTION IF EXISTS auto_create_seller_from_role_change();

-- 2. Recreate the trigger on user_roles table instead (correct location)
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
  -- Only act when seller or admin role is assigned
  IF NEW.role IN ('seller', 'admin') THEN
    -- Check if seller already exists
    IF NOT EXISTS (SELECT 1 FROM sellers WHERE user_id = NEW.user_id) THEN
      -- Get user name
      SELECT full_name INTO v_full_name FROM profiles WHERE id = NEW.user_id;
      
      -- Check if user has a store
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

CREATE TRIGGER trg_auto_create_seller_on_role
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_seller_on_role_insert();

-- 3. Fix sellers policies to use user_roles instead of profiles.role
DROP POLICY IF EXISTS "Admins pueden ver todos los sellers" ON sellers;
DROP POLICY IF EXISTS "Admins pueden actualizar sellers" ON sellers;

CREATE POLICY "Admins pueden ver todos los sellers"
  ON sellers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins pueden actualizar sellers"
  ON sellers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Fix storage policy to use user_roles instead of profiles.role
DROP POLICY IF EXISTS "Sellers can upload to product-images" ON storage.objects;

CREATE POLICY "Sellers can upload to product-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'seller')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 5. Now safely drop the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
