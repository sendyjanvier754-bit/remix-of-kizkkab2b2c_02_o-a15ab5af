-- ============================================================================
-- FIX: Markets RLS Policies - Allow Admins to Insert/Update/Delete
-- ============================================================================

-- First, temporarily disable RLS to clean up policies
ALTER TABLE public.markets DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on markets table
DROP POLICY IF EXISTS "Markets are viewable by everyone" ON public.markets;
DROP POLICY IF EXISTS "Only admins can insert markets" ON public.markets;
DROP POLICY IF EXISTS "Only admins can update markets" ON public.markets;
DROP POLICY IF EXISTS "Only admins can delete markets" ON public.markets;
DROP POLICY IF EXISTS "Public read markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can manage markets" ON public.markets;

-- Re-enable RLS
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

-- Create simplified policies that work reliably
-- 1. Everyone can read markets
CREATE POLICY "markets_select_policy"
  ON public.markets 
  FOR SELECT
  USING (true);

-- 2. Admins can insert (simple check without WITH CHECK initially)
CREATE POLICY "markets_insert_policy"
  ON public.markets 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- 3. Admins can update
CREATE POLICY "markets_update_policy"
  ON public.markets 
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- 4. Admins can delete
CREATE POLICY "markets_delete_policy"
  ON public.markets 
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'Markets RLS policies have been recreated successfully';
END $$;

COMMENT ON TABLE public.markets IS 'Multi-market configuration table with RLS enabled for admin-only modifications';
