
-- 1. seller_credits
ALTER TABLE public.seller_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seller_credits_select_own" ON public.seller_credits;
CREATE POLICY "seller_credits_select_own" ON public.seller_credits
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "seller_credits_admin_manage" ON public.seller_credits;
CREATE POLICY "seller_credits_admin_manage" ON public.seller_credits
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrals_select_involved" ON public.referrals;
CREATE POLICY "referrals_select_involved" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "referrals_admin_manage" ON public.referrals;
CREATE POLICY "referrals_admin_manage" ON public.referrals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. store_followers
ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_followers_select" ON public.store_followers;
CREATE POLICY "store_followers_select" ON public.store_followers
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "store_followers_insert_self" ON public.store_followers;
CREATE POLICY "store_followers_insert_self" ON public.store_followers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "store_followers_delete_self" ON public.store_followers;
CREATE POLICY "store_followers_delete_self" ON public.store_followers
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 6. price_settings
DROP POLICY IF EXISTS "price_settings_all" ON public.price_settings;
DROP POLICY IF EXISTS "price_settings_admin_write" ON public.price_settings;
CREATE POLICY "price_settings_admin_write" ON public.price_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. siver_match_profiles
ALTER TABLE public.siver_match_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "siver_profiles_select_own" ON public.siver_match_profiles;
CREATE POLICY "siver_profiles_select_own" ON public.siver_match_profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "siver_profiles_insert_own" ON public.siver_match_profiles;
CREATE POLICY "siver_profiles_insert_own" ON public.siver_match_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "siver_profiles_update_own" ON public.siver_match_profiles;
CREATE POLICY "siver_profiles_update_own" ON public.siver_match_profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "siver_profiles_admin_delete" ON public.siver_match_profiles;
CREATE POLICY "siver_profiles_admin_delete" ON public.siver_match_profiles
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 8. siver_match_sales
ALTER TABLE public.siver_match_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "siver_sales_select_involved" ON public.siver_match_sales;
CREATE POLICY "siver_sales_select_involved" ON public.siver_match_sales
  FOR SELECT USING (auth.uid() = investor_id OR auth.uid() = gestor_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "siver_sales_insert_involved" ON public.siver_match_sales;
CREATE POLICY "siver_sales_insert_involved" ON public.siver_match_sales
  FOR INSERT WITH CHECK (auth.uid() = investor_id OR auth.uid() = gestor_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "siver_sales_update_involved" ON public.siver_match_sales;
CREATE POLICY "siver_sales_update_involved" ON public.siver_match_sales
  FOR UPDATE USING (auth.uid() = investor_id OR auth.uid() = gestor_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = investor_id OR auth.uid() = gestor_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "siver_sales_admin_delete" ON public.siver_match_sales;
CREATE POLICY "siver_sales_admin_delete" ON public.siver_match_sales
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 9. user_favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_favorites_owner" ON public.user_favorites;
CREATE POLICY "user_favorites_owner" ON public.user_favorites
  FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- 10. seller_favorites
ALTER TABLE public.seller_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seller_favorites_owner" ON public.seller_favorites;
CREATE POLICY "seller_favorites_owner" ON public.seller_favorites
  FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- 11. credit_movements
ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_movements_select_own" ON public.credit_movements;
CREATE POLICY "credit_movements_select_own" ON public.credit_movements
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "credit_movements_admin_manage" ON public.credit_movements;
CREATE POLICY "credit_movements_admin_manage" ON public.credit_movements
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 12. user_notification_preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unp_owner" ON public.user_notification_preferences;
CREATE POLICY "unp_owner" ON public.user_notification_preferences
  FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 13. pending_quotes
DROP POLICY IF EXISTS "pending_quotes_select" ON public.pending_quotes;
DROP POLICY IF EXISTS "pending_quotes_insert" ON public.pending_quotes;
DROP POLICY IF EXISTS "pending_quotes_update" ON public.pending_quotes;
DROP POLICY IF EXISTS "pending_quotes_delete" ON public.pending_quotes;
CREATE POLICY "pending_quotes_select" ON public.pending_quotes
  FOR SELECT USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pending_quotes_insert" ON public.pending_quotes
  FOR INSERT WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pending_quotes_update" ON public.pending_quotes
  FOR UPDATE USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pending_quotes_delete" ON public.pending_quotes
  FOR DELETE USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

-- 14. b2b_margin_ranges
DROP POLICY IF EXISTS "Allow authenticated insert on b2b_margin_ranges" ON public.b2b_margin_ranges;
DROP POLICY IF EXISTS "Allow authenticated update on b2b_margin_ranges" ON public.b2b_margin_ranges;
DROP POLICY IF EXISTS "Allow authenticated delete on b2b_margin_ranges" ON public.b2b_margin_ranges;
DROP POLICY IF EXISTS "Allow authenticated select on b2b_margin_ranges" ON public.b2b_margin_ranges;
DROP POLICY IF EXISTS "b2b_margin_admin_write" ON public.b2b_margin_ranges;
CREATE POLICY "b2b_margin_admin_write" ON public.b2b_margin_ranges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 15. dynamic_expenses
DROP POLICY IF EXISTS "dynamic_expenses_all" ON public.dynamic_expenses;
DROP POLICY IF EXISTS "dynamic_expenses_admin_write" ON public.dynamic_expenses;
CREATE POLICY "dynamic_expenses_admin_write" ON public.dynamic_expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 16. asset_processing_jobs
ALTER TABLE public.asset_processing_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apj_owner" ON public.asset_processing_jobs;
CREATE POLICY "apj_owner" ON public.asset_processing_jobs
  FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 17. seller_statuses
DROP POLICY IF EXISTS "seller_statuses_all" ON public.seller_statuses;
DROP POLICY IF EXISTS "seller_statuses_owner_write" ON public.seller_statuses;
CREATE POLICY "seller_statuses_owner_write" ON public.seller_statuses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid())
  );

-- 18. po_market_settings
DROP POLICY IF EXISTS "Admin full access to po_market_settings" ON public.po_market_settings;
DROP POLICY IF EXISTS "po_market_admin" ON public.po_market_settings;
CREATE POLICY "po_market_admin" ON public.po_market_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 19. discount_code_uses
ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dcu_owner_select" ON public.discount_code_uses;
CREATE POLICY "dcu_owner_select" ON public.discount_code_uses
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "dcu_owner_insert" ON public.discount_code_uses;
CREATE POLICY "dcu_owner_insert" ON public.discount_code_uses
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "dcu_admin_manage" ON public.discount_code_uses;
CREATE POLICY "dcu_admin_manage" ON public.discount_code_uses
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 20. partner_applications: require auth for INSERT
DROP POLICY IF EXISTS "Anyone can submit application" ON public.partner_applications;
DROP POLICY IF EXISTS "Authenticated submit application" ON public.partner_applications;
CREATE POLICY "Authenticated submit application" ON public.partner_applications
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending');

-- 21. profiles: drop public read
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;

-- 22. payment-proofs storage: drop anon SELECT
DROP POLICY IF EXISTS "Public read for payment proofs" ON storage.objects;

NOTIFY pgrst, 'reload schema';
