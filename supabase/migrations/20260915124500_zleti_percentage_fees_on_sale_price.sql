-- Marketplace percentage fees are always withheld from the final sale price.
-- Normalize legacy rows that were previously marked as landed_cost.
UPDATE public.zleti_marketplace_fees
SET apply_to = 'sale_price',
    updated_at = now()
WHERE fee_type = 'percentage'
  AND apply_to <> 'sale_price';
