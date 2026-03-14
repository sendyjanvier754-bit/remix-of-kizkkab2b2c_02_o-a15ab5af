-- Add terms_accepted_at column to profiles table
-- Tracks when the user accepted the terms and conditions during registration

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp when the user accepted the Terms and Conditions during registration. NULL means not yet accepted.';
