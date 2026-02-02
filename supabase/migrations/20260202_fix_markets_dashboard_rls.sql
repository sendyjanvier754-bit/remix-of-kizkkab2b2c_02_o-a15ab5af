-- ============================================================================
-- FIX: Markets Dashboard View - Add RLS Policies
-- ============================================================================

-- Views inherit RLS from base tables, but we need to ensure the view is accessible
-- The issue is that markets_dashboard is a VIEW, not a table
-- Views don't have their own RLS policies - they use the policies of underlying tables

-- Let's verify the markets table has proper SELECT policy
-- This should already exist from previous migration

-- Ensure markets table allows public SELECT
DROP POLICY IF EXISTS "markets_select_policy" ON public.markets;

CREATE POLICY "markets_select_policy"
  ON public.markets 
  FOR SELECT
  USING (true);

-- Verify RLS is enabled
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

-- Add a comment to the view
COMMENT ON VIEW public.markets_dashboard IS 'Dashboard view of markets with related data - inherits RLS from markets table';

-- Test query to verify (run this separately in SQL Editor to debug)
-- SELECT * FROM public.markets_dashboard;
