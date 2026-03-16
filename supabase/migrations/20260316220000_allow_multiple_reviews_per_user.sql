-- Allow multiple top-level reviews per user per store (remove the partial unique index)
DROP INDEX IF EXISTS public.idx_store_reviews_top_level_unique;

NOTIFY pgrst, 'reload schema';
