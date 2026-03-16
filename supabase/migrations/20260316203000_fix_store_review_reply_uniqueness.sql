-- Allow multiple replies per user/store while keeping one top-level review per user/store
-- The old unique constraint on (store_id, user_id) blocks replies because replies use the same user/store pair.

ALTER TABLE public.store_reviews
  DROP CONSTRAINT IF EXISTS store_reviews_store_id_user_id_key;

DROP INDEX IF EXISTS public.store_reviews_store_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_reviews_top_level_unique
  ON public.store_reviews (store_id, user_id)
  WHERE parent_review_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_reviews_parent_created_at
  ON public.store_reviews (parent_review_id, created_at);

NOTIFY pgrst, 'reload schema';
