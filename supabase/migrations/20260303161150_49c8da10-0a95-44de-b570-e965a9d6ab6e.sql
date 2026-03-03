
-- =====================================================
-- PO MAESTRA PERPETUA POR MERCADO
-- =====================================================

-- 1. Add market_id to master_purchase_orders for per-market POs
ALTER TABLE public.master_purchase_orders 
  ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id),
  ADD COLUMN IF NOT EXISTS close_trigger TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scheduled_close_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weight_threshold_kg NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_threshold INTEGER DEFAULT 0;

-- 2. Add preparing status and tracking fields to orders_b2b
ALTER TABLE public.orders_b2b
  ADD COLUMN IF NOT EXISTS internal_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_segment TEXT DEFAULT 'china';

-- 3. Create PO close settings per market
CREATE TABLE IF NOT EXISTS public.po_market_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  auto_close_enabled BOOLEAN DEFAULT false,
  close_mode TEXT DEFAULT 'manual', -- 'manual', 'time', 'quantity', 'weight', 'hybrid'
  close_cron_expression TEXT, -- e.g. '0 0 * * 5' for every Friday midnight
  quantity_threshold INTEGER DEFAULT 50,
  weight_threshold_kg NUMERIC DEFAULT 500,
  time_interval_hours INTEGER DEFAULT 168, -- 7 days default
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(market_id)
);

ALTER TABLE public.po_market_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to po_market_settings" ON public.po_market_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Function to get or create active PO per market
CREATE OR REPLACE FUNCTION public.get_or_create_market_po(p_market_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_market RECORD;
  v_po_number TEXT;
  v_next_seq INT;
BEGIN
  -- Get market info
  SELECT * INTO v_market FROM public.markets WHERE id = p_market_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Market not found');
  END IF;

  -- Check for existing open PO for this market
  SELECT * INTO v_po 
  FROM public.master_purchase_orders 
  WHERE market_id = p_market_id 
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true, 
      'po_id', v_po.id, 
      'po_number', v_po.po_number,
      'is_new', false
    );
  END IF;

  -- Generate next PO number: PO-{MARKET_CODE}-{SEQ}
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(po_number, '^PO-' || v_market.code || '-', ''), '') AS INTEGER)
  ), 0) + 1
  INTO v_next_seq
  FROM public.master_purchase_orders
  WHERE market_id = p_market_id;

  v_po_number := 'PO-' || v_market.code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  -- Create new PO
  INSERT INTO public.master_purchase_orders (
    po_number, status, market_id, country_code,
    cycle_start_at, total_orders, total_quantity, total_amount
  ) VALUES (
    v_po_number, 'open', p_market_id, v_market.code,
    NOW(), 0, 0, 0
  )
  RETURNING * INTO v_po;

  RETURN json_build_object(
    'success', true, 
    'po_id', v_po.id, 
    'po_number', v_po.po_number,
    'is_new', true
  );
END;
$$;

-- 5. Function to close PO and auto-open next one (perpetual cycle)
CREATE OR REPLACE FUNCTION public.close_market_po_and_open_next(
  p_po_id UUID,
  p_close_reason TEXT DEFAULT 'manual'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_market RECORD;
  v_new_po JSON;
  v_orders_count INT;
  v_tracking_base TEXT;
  v_order RECORD;
  v_random_code TEXT;
  v_dept_code TEXT;
  v_hub_code TEXT;
BEGIN
  -- Get the PO
  SELECT * INTO v_po FROM public.master_purchase_orders WHERE id = p_po_id AND status = 'open';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'PO not found or not open');
  END IF;

  -- Get market info
  SELECT * INTO v_market FROM public.markets WHERE id = v_po.market_id;

  -- Get hub code
  SELECT th.code INTO v_hub_code
  FROM public.shipping_routes sr
  JOIN public.transit_hubs th ON sr.transit_hub_id = th.id
  WHERE sr.id = v_market.shipping_route_id
  LIMIT 1;

  -- Count and update all linked orders to 'preparing'
  UPDATE public.orders_b2b
  SET 
    status = 'preparing',
    preparing_at = NOW(),
    updated_at = NOW()
  WHERE master_po_id = p_po_id
    AND status IN ('paid', 'placed');

  GET DIAGNOSTICS v_orders_count = ROW_COUNT;

  -- Generate internal tracking IDs for all orders in this PO
  FOR v_order IN 
    SELECT ob.id, ob.department_code, ob.master_po_id
    FROM public.orders_b2b ob
    WHERE ob.master_po_id = p_po_id
  LOOP
    -- Generate 4-char random code
    v_random_code := upper(substr(md5(random()::text), 1, 4));
    v_dept_code := COALESCE(v_order.department_code, 'XX');
    
    -- Format: [COUNTRY]-[DEPT]-[PO_NUMBER]-[CHINA_TRACKING]-[HUB]-[XXXX]
    v_tracking_base := COALESCE(v_market.code, 'XX') || '-' || 
                       v_dept_code || '-' ||
                       v_po.po_number || '-' ||
                       '________' || '-' ||  -- Placeholder for China tracking
                       COALESCE(v_hub_code, 'XX') || '-' ||
                       v_random_code;

    UPDATE public.orders_b2b
    SET internal_tracking_id = v_tracking_base
    WHERE id = v_order.id;
  END LOOP;

  -- Close the current PO
  UPDATE public.master_purchase_orders
  SET 
    status = 'closed',
    closed_at = NOW(),
    cycle_end_at = NOW(),
    close_reason = p_close_reason,
    orders_at_close = v_orders_count,
    updated_at = NOW()
  WHERE id = p_po_id;

  -- Auto-create next PO for the same market (perpetual cycle)
  v_new_po := public.get_or_create_market_po(v_po.market_id);

  RETURN json_build_object(
    'success', true,
    'closed_po_number', v_po.po_number,
    'orders_transitioned', v_orders_count,
    'close_reason', p_close_reason,
    'new_po', v_new_po
  );
END;
$$;

-- 6. Function to update China tracking in tracking IDs
CREATE OR REPLACE FUNCTION public.update_po_china_tracking(
  p_po_id UUID,
  p_china_tracking TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INT;
BEGIN
  -- Update china_tracking on the PO
  UPDATE public.master_purchase_orders
  SET china_tracking = p_china_tracking, updated_at = NOW()
  WHERE id = p_po_id;

  -- Replace placeholder in all order tracking IDs
  UPDATE public.orders_b2b
  SET internal_tracking_id = replace(internal_tracking_id, '________', p_china_tracking),
      updated_at = NOW()
  WHERE master_po_id = p_po_id
    AND internal_tracking_id LIKE '%________%';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'orders_updated', v_updated,
    'china_tracking', p_china_tracking
  );
END;
$$;

-- 7. Function to get PO stats per market
CREATE OR REPLACE FUNCTION public.get_market_po_dashboard()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT 
      m.id as market_id,
      m.name as market_name,
      m.code as market_code,
      po.id as active_po_id,
      po.po_number as active_po_number,
      po.cycle_start_at,
      COALESCE(po.total_orders, 0) as total_orders,
      COALESCE(po.total_quantity, 0) as total_quantity,
      COALESCE(po.total_amount, 0) as total_amount,
      po.china_tracking,
      pms.close_mode,
      pms.quantity_threshold,
      pms.weight_threshold_kg,
      pms.time_interval_hours,
      pms.auto_close_enabled,
      (
        SELECT COUNT(*) 
        FROM public.master_purchase_orders closed_po
        WHERE closed_po.market_id = m.id AND closed_po.status = 'closed'
      ) as closed_pos_count
    FROM public.markets m
    LEFT JOIN public.master_purchase_orders po 
      ON po.market_id = m.id AND po.status = 'open'
    LEFT JOIN public.po_market_settings pms
      ON pms.market_id = m.id
    WHERE m.is_active = true
    ORDER BY m.sort_order, m.name
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- 8. Trigger to auto-update PO totals when orders change
CREATE OR REPLACE FUNCTION public.update_po_totals_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the PO totals when an order is linked or updated
  IF NEW.master_po_id IS NOT NULL THEN
    UPDATE public.master_purchase_orders
    SET 
      total_orders = (
        SELECT COUNT(*) FROM public.orders_b2b 
        WHERE master_po_id = NEW.master_po_id AND status NOT IN ('cancelled', 'draft')
      ),
      total_quantity = (
        SELECT COALESCE(SUM(total_quantity), 0) FROM public.orders_b2b 
        WHERE master_po_id = NEW.master_po_id AND status NOT IN ('cancelled', 'draft')
      ),
      total_amount = (
        SELECT COALESCE(SUM(total_amount), 0) FROM public.orders_b2b 
        WHERE master_po_id = NEW.master_po_id AND status NOT IN ('cancelled', 'draft')
      ),
      updated_at = NOW()
    WHERE id = NEW.master_po_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trg_update_po_totals ON public.orders_b2b;
CREATE TRIGGER trg_update_po_totals
  AFTER INSERT OR UPDATE ON public.orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_totals_on_order_change();

-- 9. Ensure orders_b2b has 'preparing' as a valid status
-- (Status is a text field, so no enum change needed)

-- 10. Add index for performance
CREATE INDEX IF NOT EXISTS idx_master_po_market_status 
  ON public.master_purchase_orders(market_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_b2b_master_po 
  ON public.orders_b2b(master_po_id) WHERE master_po_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_b2b_internal_tracking 
  ON public.orders_b2b(internal_tracking_id) WHERE internal_tracking_id IS NOT NULL;
