-- Speed up marketplace banner query used by useMarketplaceBanners
-- Filters: is_active, target_audience, starts_at/ends_at range, ordered by sort_order

CREATE INDEX IF NOT EXISTS idx_admin_banners_marketplace_active_sort
  ON public.admin_banners (sort_order, starts_at, ends_at)
  WHERE is_active = true AND target_audience IN ('all', 'b2c');

-- Helpful secondary index for admin views that frequently sort by active + sort_order
CREATE INDEX IF NOT EXISTS idx_admin_banners_active_sort
  ON public.admin_banners (is_active, sort_order);
