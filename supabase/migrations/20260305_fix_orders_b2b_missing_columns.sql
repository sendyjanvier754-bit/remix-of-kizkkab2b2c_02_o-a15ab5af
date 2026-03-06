-- Fix: Add missing columns to orders_b2b that the close_market_po_and_open_next function requires.
-- Error: "column ob.department_code does not exist" (code 42703)

ALTER TABLE public.orders_b2b
  ADD COLUMN IF NOT EXISTS department_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS master_po_id UUID REFERENCES public.master_purchase_orders(id),
  ADD COLUMN IF NOT EXISTS internal_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_segment TEXT DEFAULT 'china';

CREATE INDEX IF NOT EXISTS idx_orders_b2b_master_po ON public.orders_b2b(master_po_id);
