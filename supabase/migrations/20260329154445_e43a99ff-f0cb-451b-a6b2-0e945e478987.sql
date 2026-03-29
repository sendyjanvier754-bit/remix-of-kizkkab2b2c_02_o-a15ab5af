ALTER TABLE public.seller_catalog_variants 
ADD COLUMN IF NOT EXISTS is_manual_price boolean NOT NULL DEFAULT false;