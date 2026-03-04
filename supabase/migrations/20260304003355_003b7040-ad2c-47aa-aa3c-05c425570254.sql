-- =====================================================
-- FIX: Add missing payment_verified_by column + PO linking on payment confirmation
-- =====================================================

-- 1️⃣ Add the missing column that the trigger references
ALTER TABLE public.orders_b2b 
ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users(id);

-- 2️⃣ Drop duplicate trigger (there are two triggers calling the same function)
DROP TRIGGER IF EXISTS trigger_auto_add_to_seller_catalog_on_complete ON public.orders_b2b;

-- 3️⃣ Create function to link order to Master PO when payment is confirmed
CREATE OR REPLACE FUNCTION public.link_order_to_market_po_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_id UUID;
  v_po_id UUID;
  v_store RECORD;
BEGIN
  -- Only fire when payment_status changes to 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    
    -- Skip if already linked to a PO
    IF NEW.master_po_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get the seller's store to find their market
    SELECT s.market_id INTO v_market_id
    FROM stores s
    WHERE s.owner_user_id = NEW.seller_id
    LIMIT 1;
    
    IF v_market_id IS NULL THEN
      RAISE NOTICE 'No market found for seller %, skipping PO link', NEW.seller_id;
      RETURN NEW;
    END IF;
    
    -- Find or create the active PO for this market
    SELECT id INTO v_po_id
    FROM master_purchase_orders
    WHERE market_id = v_market_id
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no open PO exists, create one via the RPC (but we can't call RPC from trigger easily)
    -- Instead, create directly
    IF v_po_id IS NULL THEN
      INSERT INTO master_purchase_orders (
        po_number,
        market_id,
        status,
        cycle_start_at
      ) VALUES (
        'PO-' || (SELECT code FROM markets WHERE id = v_market_id) || '-' || 
          LPAD((SELECT COALESCE(MAX(
            CASE WHEN po_number ~ '\d+$' 
            THEN (regexp_match(po_number, '(\d+)$'))[1]::int 
            ELSE 0 END
          ), 0) + 1 FROM master_purchase_orders WHERE market_id = v_market_id)::text, 3, '0'),
        v_market_id,
        'open',
        now()
      )
      RETURNING id INTO v_po_id;
    END IF;
    
    -- Link the order to the PO
    NEW.master_po_id := v_po_id;
    NEW.po_linked_at := now();
    NEW.payment_confirmed_at := now();
    
    RAISE NOTICE '✅ Order % linked to PO % (market: %)', NEW.id, v_po_id, v_market_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4️⃣ Create the trigger (BEFORE UPDATE so we can modify NEW)
DROP TRIGGER IF EXISTS trg_link_order_to_po_on_payment ON public.orders_b2b;
CREATE TRIGGER trg_link_order_to_po_on_payment
  BEFORE UPDATE ON public.orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION public.link_order_to_market_po_on_payment();

-- 5️⃣ Fix the coverage_active error by checking if v_seller_inventory view references it
-- (This is a separate issue but let's check)
