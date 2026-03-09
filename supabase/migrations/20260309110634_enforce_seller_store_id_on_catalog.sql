-- MIGRATION: Enforce seller_store_id on seller_catalog
-- Every product in a seller's catalog MUST be linked to a store.
-- This migration:
--   1. Backfills any NULL seller_store_id using the order → buyer → store chain
--   2. Adds a BEFORE INSERT / UPDATE trigger that auto-fills seller_store_id
--      when it is NULL (defensive fallback via source_order_id)
--   3. Adds a NOT NULL constraint so the column can never be NULL again

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. BACKFILL: rows added via B2B order (source_order_id IS NOT NULL)
--    seller_catalog.source_order_id → orders_b2b.buyer_id → stores.owner_user_id
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE public.seller_catalog sc
SET    seller_store_id = st.id
FROM   public.orders_b2b o
JOIN   public.stores      st ON st.owner_user_id = o.buyer_id
WHERE  sc.seller_store_id IS NULL
  AND  sc.source_order_id  IS NOT NULL
  AND  sc.source_order_id  = o.id;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL: rows that still have NULL (e.g. manually inserted or edge cases)
--    Try to match via sellers table (user_id → store_id)
--    This handles rows where we can infer ownership from the sellers table.
--    We join via source_product_id → products → (no direct user link)
--    so we can only help if there is exactly ONE store owning the product catalog
--    entry by matching via the sellers table.
--
--    Safer approach: delete orphaned rows (no store, no order linkage).
--    We report them first so nothing is deleted silently.
-- ──────────────────────────────────────────────────────────────────────────────

-- Show any rows that are still NULL after step 1 (informational DO block)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.seller_catalog
  WHERE seller_store_id IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING 'seller_catalog: % rows still have NULL seller_store_id after backfill via orders. These rows will be DELETED to enforce the NOT NULL constraint.', v_count;
  END IF;
END $$;

-- Delete any remaining orphaned rows (no store can be inferred — they are unusable)
DELETE FROM public.seller_catalog
WHERE seller_store_id IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ENFORCE NOT NULL on seller_store_id
--    If the column was already NOT NULL, this is a no-op equivalent.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.seller_catalog
  ALTER COLUMN seller_store_id SET NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: auto-fill seller_store_id on INSERT when NULL
--    Uses source_order_id → orders_b2b → buyer_id → stores
--    This is a defensive last-resort so the NOT NULL never fires an error.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_fill_seller_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Only try to fill when seller_store_id is missing
  IF NEW.seller_store_id IS NULL THEN

--    -- Attempt 1: via source_order_id → orders_b2b → buyer_id → stores
    IF NEW.source_order_id IS NOT NULL THEN
      SELECT st.id INTO v_store_id
      FROM   public.orders_b2b o
      JOIN   public.stores      st ON st.owner_user_id = o.buyer_id
      WHERE  o.id = NEW.source_order_id
      LIMIT  1;

      IF v_store_id IS NOT NULL THEN
        NEW.seller_store_id := v_store_id;
      END IF;
    END IF;

    -- If still NULL after all attempts, raise an error with a clear message
    IF NEW.seller_store_id IS NULL THEN
      RAISE EXCEPTION
        'seller_catalog: seller_store_id is required. Every catalog entry must belong to a store. '
        'Provide seller_store_id directly or via a valid source_order_id.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger (runs before every INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_fill_seller_store_id ON public.seller_catalog;
CREATE TRIGGER trg_fill_seller_store_id
  BEFORE INSERT OR UPDATE ON public.seller_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fill_seller_store_id();

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Also ensure auto_create_seller_catalog trigger (for B2B orders) always
--    passes seller_store_id. This is a safety check — nothing to change in SQL
--    since the existing trigger already uses v_store_id. Documented here.
-- ──────────────────────────────────────────────────────────────────────────────
-- NOTE: The trigger fn_auto_populate_seller_catalog (in ACTUALIZAR_TRIGGER_CON_CANCELACIONES.sql)
-- already sets seller_store_id = v_store_id (derived from orders_b2b → buyer_id → stores).
-- The new trigger above is a second safety net for any code path that forgets.
