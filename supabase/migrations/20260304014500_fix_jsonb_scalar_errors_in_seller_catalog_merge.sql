-- =====================================================
-- FIX: Avoid JSONB scalar/array errors in duplicate merge trigger
-- =====================================================
-- Some historical rows may have seller_catalog.images or metadata with unexpected
-- JSONB types (scalar/object/array). jsonb_array_length() over non-array throws.
-- This replaces the merge function with type-safe JSON handling.

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
  IF NEW.seller_store_id IS NULL OR NEW.source_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_seller_catalog_unique_store_product'
  )
  INTO v_has_store_product_unique;

  IF v_has_store_product_unique THEN
    SELECT sc.id
    INTO v_existing_id
    FROM public.seller_catalog sc
    WHERE sc.seller_store_id = NEW.seller_store_id
      AND sc.source_product_id IS NOT DISTINCT FROM NEW.source_product_id
    ORDER BY sc.updated_at DESC NULLS LAST, sc.created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
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
      metadata =
        (CASE WHEN jsonb_typeof(COALESCE(sc.metadata, '{}'::jsonb)) = 'object'
              THEN COALESCE(sc.metadata, '{}'::jsonb)
              ELSE '{}'::jsonb
         END)
        ||
        (CASE WHEN jsonb_typeof(COALESCE(NEW.metadata, '{}'::jsonb)) = 'object'
              THEN COALESCE(NEW.metadata, '{}'::jsonb)
              ELSE '{}'::jsonb
         END),
      images = CASE
        WHEN jsonb_typeof(COALESCE(sc.images, '[]'::jsonb)) = 'array'
             AND jsonb_array_length(COALESCE(sc.images, '[]'::jsonb)) > 0
          THEN COALESCE(sc.images, '[]'::jsonb)
        WHEN jsonb_typeof(COALESCE(NEW.images, '[]'::jsonb)) = 'array'
             AND jsonb_array_length(COALESCE(NEW.images, '[]'::jsonb)) > 0
          THEN COALESCE(NEW.images, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    WHERE sc.id = v_existing_id;

    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.merge_duplicate_seller_catalog_insert() SET search_path = public;
