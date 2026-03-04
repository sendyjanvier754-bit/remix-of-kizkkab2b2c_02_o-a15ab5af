-- =====================================================
-- FIX: Prevent duplicate-key conflicts in seller_catalog during payment confirmation
-- =====================================================
-- Root cause in logs:
--   409 duplicate key value violates unique constraint on seller_catalog
--
-- During admin_confirm_payment, inventory triggers may attempt INSERT for a product
-- that already exists for the same store/product(/variant), causing transaction rollback.
--
-- Strategy:
-- 1) BEFORE INSERT trigger merges with existing row
-- 2) Increments stock instead of failing
-- 3) Supports both uniqueness models:
--    - idx_seller_catalog_unique_store_product (store+product)
--    - seller_catalog_unique_product_variant_store (store+product+variant)

CREATE OR REPLACE FUNCTION public.merge_duplicate_seller_catalog_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_has_store_product_unique BOOLEAN;
BEGIN
  -- Only relevant when product/store are present
  IF NEW.seller_store_id IS NULL OR NEW.source_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the "1 row per store+product" unique index exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_seller_catalog_unique_store_product'
  )
  INTO v_has_store_product_unique;

  IF v_has_store_product_unique THEN
    -- Newer model: one row per (store, product)
    SELECT sc.id
    INTO v_existing_id
    FROM public.seller_catalog sc
    WHERE sc.seller_store_id = NEW.seller_store_id
      AND sc.source_product_id IS NOT DISTINCT FROM NEW.source_product_id
    ORDER BY sc.updated_at DESC NULLS LAST, sc.created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    -- Legacy model: one row per (store, product, variant)
    SELECT sc.id
    INTO v_existing_id
    FROM public.seller_catalog sc
    WHERE sc.seller_store_id = NEW.seller_store_id
      AND sc.source_product_id IS NOT DISTINCT FROM NEW.source_product_id
      AND sc.variant_id IS NOT DISTINCT FROM NEW.variant_id
    ORDER BY sc.updated_at DESC NULLS LAST, sc.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.seller_catalog sc
    SET
      stock = COALESCE(sc.stock, 0) + COALESCE(NEW.stock, 0),
      updated_at = NOW(),
      source_order_id = COALESCE(NEW.source_order_id, sc.source_order_id),
      precio_costo = COALESCE(NULLIF(NEW.precio_costo, 0), sc.precio_costo),
      precio_venta = COALESCE(NULLIF(NEW.precio_venta, 0), sc.precio_venta),
      precio_b2b_base = COALESCE(NULLIF(NEW.precio_b2b_base, 0), sc.precio_b2b_base),
      costo_logistica = COALESCE(NULLIF(NEW.costo_logistica, 0), sc.costo_logistica),
      metadata = COALESCE(sc.metadata, '{}'::jsonb) || COALESCE(NEW.metadata, '{}'::jsonb),
      images = CASE
        WHEN COALESCE(jsonb_array_length(sc.images), 0) = 0 AND COALESCE(jsonb_array_length(NEW.images), 0) > 0 THEN NEW.images
        ELSE sc.images
      END
    WHERE sc.id = v_existing_id;

    -- Skip INSERT to avoid unique violation
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_merge_duplicate_seller_catalog_insert ON public.seller_catalog;

CREATE TRIGGER trg_00_merge_duplicate_seller_catalog_insert
  BEFORE INSERT ON public.seller_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.merge_duplicate_seller_catalog_insert();

ALTER FUNCTION public.merge_duplicate_seller_catalog_insert() SET search_path = public;
