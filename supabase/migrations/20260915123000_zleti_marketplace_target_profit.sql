-- Store the desired net profit per unit independently for each ZleTI marketplace.
ALTER TABLE public.zleti_marketplaces
  ADD COLUMN IF NOT EXISTS target_profit_per_unit numeric(12, 2) NOT NULL DEFAULT 50
  CHECK (target_profit_per_unit >= 0);

NOTIFY pgrst, 'reload schema';
