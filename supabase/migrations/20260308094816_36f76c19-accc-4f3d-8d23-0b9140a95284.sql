
-- Trigger function: after PO totals are updated, check if auto-close thresholds are met
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

  -- Check quantity threshold
  IF v_settings.quantity_threshold IS NOT NULL 
     AND v_settings.quantity_threshold > 0 
     AND NEW.total_quantity >= v_settings.quantity_threshold THEN
    v_should_close := TRUE;
    v_close_reason := 'auto_quantity_threshold (' || NEW.total_quantity || '/' || v_settings.quantity_threshold || ')';
  END IF;

  -- Check time threshold (hours since cycle start)
  IF NOT v_should_close
     AND v_settings.time_interval_hours IS NOT NULL 
     AND v_settings.time_interval_hours > 0
     AND NEW.cycle_start_at IS NOT NULL
     AND NOW() >= NEW.cycle_start_at + (v_settings.time_interval_hours || ' hours')::INTERVAL THEN
    v_should_close := TRUE;
    v_close_reason := 'auto_time_threshold (' || v_settings.time_interval_hours || 'h)';
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

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_check_po_auto_close ON public.master_purchase_orders;

-- Create trigger: fires AFTER UPDATE on master_purchase_orders (when totals change)
CREATE TRIGGER trg_check_po_auto_close
  AFTER UPDATE OF total_orders, total_quantity, total_amount
  ON public.master_purchase_orders
  FOR EACH ROW
  WHEN (NEW.status = 'open')
  EXECUTE FUNCTION public.check_po_auto_close_thresholds();
