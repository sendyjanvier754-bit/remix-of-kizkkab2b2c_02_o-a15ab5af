-- Add photos and reply support to store_reviews
-- photos: JSON array of public URLs
-- parent_review_id: self-referential FK for replies

ALTER TABLE public.store_reviews
  ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_review_id uuid REFERENCES public.store_reviews(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_store_reviews_parent ON public.store_reviews(parent_review_id);

-- Refresh schema cache by notifying PostgREST
NOTIFY pgrst, 'reload schema';
