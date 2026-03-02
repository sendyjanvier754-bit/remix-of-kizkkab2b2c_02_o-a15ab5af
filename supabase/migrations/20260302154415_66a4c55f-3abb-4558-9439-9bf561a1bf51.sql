-- Add UNIQUE constraint on seller_catalog(seller_store_id, source_product_id)
-- to enforce 1 product row per store (Amazon/Alibaba pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_catalog_unique_store_product 
ON seller_catalog (seller_store_id, source_product_id) 
WHERE source_product_id IS NOT NULL;

-- Ensure seller_catalog_variants has a unique constraint per catalog+variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_catalog_variants_unique 
ON seller_catalog_variants (seller_catalog_id, variant_id);