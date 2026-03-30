
-- =============================================================================
-- Add user_code auto-generation to handle_new_user_profile trigger
-- and backfill existing profiles without user_code
-- =============================================================================

-- 1. Update the trigger function to auto-generate user_code
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_code TEXT;
BEGIN
  -- Generate unique user_code: KZ + 10 hex uppercase + 2-digit year
  LOOP
    v_user_code := 'KZ' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 10)) || TO_CHAR(NOW(), 'YY');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = v_user_code);
  END LOOP;

  INSERT INTO public.profiles (id, email, full_name, user_code, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    v_user_code,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    user_code = CASE WHEN profiles.user_code IS NULL THEN EXCLUDED.user_code ELSE profiles.user_code END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- 2. Backfill existing profiles that don't have a user_code
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE user_code IS NULL
  LOOP
    LOOP
      v_code := 'KZ' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 10)) || TO_CHAR(NOW(), 'YY');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = v_code);
    END LOOP;
    
    UPDATE public.profiles SET user_code = v_code, updated_at = NOW() WHERE id = r.id;
  END LOOP;
END $$;
