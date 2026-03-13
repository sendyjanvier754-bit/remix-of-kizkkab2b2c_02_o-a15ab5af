
-- =====================================================
-- 1. Update link_order_to_market_po_on_payment
--    Check if open PO is expired BEFORE linking.
--    If expired → close it, get new PO, link order there.
-- =====================================================
CREATE OR REPLACE FUNCTION public.link_order_to_market_po_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_id UUID;
  v_po_id UUID;
  v_po_cycle_start TIMESTAMPTZ;
  v_time_interval INT;
  v_po_expired BOOLEAN := FALSE;
  v_close_result JSON;
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
    
    -- Find the active open PO for this market
    SELECT id, cycle_start_at INTO v_po_id, v_po_cycle_start
    FROM master_purchase_orders
    WHERE market_id = v_market_id
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If open PO exists, check if it's expired by time
    IF v_po_id IS NOT NULL AND v_po_cycle_start IS NOT NULL THEN
      SELECT pms.time_interval_hours INTO v_time_interval
      FROM po_market_settings pms
      WHERE pms.market_id = v_market_id
        AND pms.auto_close_enabled = TRUE
        AND pms.is_active = TRUE;
      
      IF v_time_interval IS NOT NULL AND v_time_interval > 0
         AND NOW() >= v_po_cycle_start + (v_time_interval || ' hours')::INTERVAL THEN
        -- PO is expired → close it first, keeping all its existing orders
        RAISE NOTICE '⏰ PO % expired by time, closing before linking new order', v_po_id;
        v_close_result := public.close_market_po_and_open_next(v_po_id, 'auto_time_expired');
        RAISE NOTICE '✅ Expired PO closed: %', v_close_result;
        
        -- Get the newly created open PO
        SELECT id INTO v_po_id
        FROM master_purchase_orders
        WHERE market_id = v_market_id
          AND status = 'open'
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;
    END IF;
    
    -- If still no open PO, create one
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

-- =====================================================
-- 2. Remove time check from check_po_auto_close_thresholds
--    Keep ONLY quantity threshold. Time is now handled
--    in link_order_to_market_po_on_payment above.
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_po_auto_close_thresholds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_should_close BOOLEAN := FALSE;
  v_close_reason TEXT;
  v_result JSON;
BEGIN
  -- Only check open POs that just had totals updated
  IF NEW.status != 'open' THEN
    RETURN NEW;
  END IF;

  -- Skip if no market_id
  IF NEW.market_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get auto-close settings for this market
  SELECT * INTO v_settings
  FROM public.po_market_settings
  WHERE market_id = NEW.market_id
    AND auto_close_enabled = TRUE
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check quantity threshold ONLY
  IF v_settings.quantity_threshold IS NOT NULL 
     AND v_settings.quantity_threshold > 0 
     AND NEW.total_quantity >= v_settings.quantity_threshold THEN
    v_should_close := TRUE;
    v_close_reason := 'auto_quantity_threshold (' || NEW.total_quantity || '/' || v_settings.quantity_threshold || ')';
  END IF;

  -- If threshold met, close PO and open next
  IF v_should_close THEN
    RAISE NOTICE '🔄 Auto-closing PO % (reason: %)', NEW.po_number, v_close_reason;
    v_result := public.close_market_po_and_open_next(NEW.id, v_close_reason);
    RAISE NOTICE '✅ Auto-close result: %', v_result;
  END IF;

  RETURN NEW;
END;
$$;
