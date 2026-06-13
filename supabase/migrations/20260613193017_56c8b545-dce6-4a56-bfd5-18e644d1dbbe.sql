
-- 1) Set immutable search_path on flagged functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN (
        'add_to_buyer_inventory_on_payment','auto_copy_weight_to_variant',
        'calculate_cart_shipping_cost_dynamic','calculate_shipping_cost_cart',
        'calculate_shipping_cost_for_selected_items','calculate_suggested_pvp',
        'calculate_suggested_pvp_with_details','check_mdc_route_country_match',
        'fn_addresses_set_destination_country','fn_auto_set_peso_kg',
        'fn_fill_seller_store_id','get_cart_shipping_cost',
        'get_catalog_fastest_shipping_cost_by_product','get_product_market_analysis',
        'get_product_shipping_cost_by_country','refresh_market_is_ready',
        'refresh_suggested_pvp_cache','remove_from_buyer_inventory_on_cancel',
        'set_updated_at','set_updated_at_metadata','sync_product_weights',
        'sync_shipping_tiers_from_segments','touch_updated_at',
        'trg_refresh_market_ready_from_route','trg_refresh_market_ready_from_tier',
        'update_seller_catalog_variants_updated_at',
        'update_seller_inventory_from_b2b_order',
        'update_user_payment_profiles_updated_at'
      )
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END$$;

-- 2) Enable RLS on tables with existing policies but RLS off
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_attribute_values ENABLE ROW LEVEL SECURITY;

-- 3) Enable RLS on remaining public tables and add safe policies

-- Reference / lookup data (public read, admin write)
ALTER TABLE public.destination_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY destination_countries_read ON public.destination_countries FOR SELECT USING (true);
CREATE POLICY destination_countries_admin ON public.destination_countries FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_routes_read ON public.shipping_routes FOR SELECT USING (true);
CREATE POLICY shipping_routes_admin ON public.shipping_routes FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipping_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_tiers_read ON public.shipping_tiers FOR SELECT USING (true);
CREATE POLICY shipping_tiers_admin ON public.shipping_tiers FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_zones_read ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY shipping_zones_admin ON public.shipping_zones FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_rates_read ON public.shipping_rates FOR SELECT USING (true);
CREATE POLICY shipping_rates_admin ON public.shipping_rates FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipping_types_per_route ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_types_read ON public.shipping_types_per_route FOR SELECT USING (true);
CREATE POLICY shipping_types_admin ON public.shipping_types_per_route FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.category_shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_shipping_rates_read ON public.category_shipping_rates FOR SELECT USING (true);
CREATE POLICY category_shipping_rates_admin ON public.category_shipping_rates FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.route_logistics_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_logistics_costs_read ON public.route_logistics_costs FOR SELECT USING (true);
CREATE POLICY route_logistics_costs_admin ON public.route_logistics_costs FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.transit_hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY transit_hubs_read ON public.transit_hubs FOR SELECT USING (true);
CREATE POLICY transit_hubs_admin ON public.transit_hubs FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_settings_read ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY platform_settings_admin ON public.platform_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_read ON public.payment_methods FOR SELECT USING (true);
CREATE POLICY payment_methods_admin ON public.payment_methods FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.marketplace_section_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_section_settings_read ON public.marketplace_section_settings FOR SELECT USING (true);
CREATE POLICY marketplace_section_settings_admin ON public.marketplace_section_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_settings_read ON public.referral_settings FOR SELECT USING (true);
CREATE POLICY referral_settings_admin ON public.referral_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.category_attribute_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_attribute_templates_read ON public.category_attribute_templates FOR SELECT USING (true);
CREATE POLICY category_attribute_templates_admin ON public.category_attribute_templates FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY variant_attribute_values_admin ON public.variant_attribute_values FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.b2b_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY b2b_batches_read ON public.b2b_batches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY b2b_batches_admin ON public.b2b_batches FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.batch_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_inventory_read ON public.batch_inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY batch_inventory_admin ON public.batch_inventory FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_tracking_read ON public.shipment_tracking FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY shipment_tracking_admin ON public.shipment_tracking FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY order_deliveries_read ON public.order_deliveries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY order_deliveries_admin ON public.order_deliveries FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Tracking / analytics (anon insert, admin read)
ALTER TABLE public.catalog_click_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_click_insert ON public.catalog_click_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY catalog_click_admin ON public.catalog_click_tracking FOR SELECT USING (has_role(auth.uid(),'admin'));

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_views_insert ON public.product_views FOR INSERT WITH CHECK (true);
CREATE POLICY product_views_admin ON public.product_views FOR SELECT USING (has_role(auth.uid(),'admin'));

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_price_history_admin ON public.product_price_history FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_movements_admin ON public.inventory_movements FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_ratings_read ON public.delivery_ratings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY delivery_ratings_admin ON public.delivery_ratings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.asset_processing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_processing_items_admin ON public.asset_processing_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- User-owned
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_codes_select_own ON public.referral_codes FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY referral_codes_insert_own ON public.referral_codes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY referral_codes_admin ON public.referral_codes FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.pickup_point_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY pickup_point_staff_select_own ON public.pickup_point_staff FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY pickup_point_staff_admin ON public.pickup_point_staff FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.siver_match_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY siver_match_reviews_read ON public.siver_match_reviews FOR SELECT USING (true);
CREATE POLICY siver_match_reviews_admin ON public.siver_match_reviews FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Sensitive / admin-only
ALTER TABLE public.sensitive_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensitive_products_admin ON public.sensitive_products FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.products_peso_backup_20260212 ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_peso_backup_admin ON public.products_peso_backup_20260212 FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.seller_catalog_backup_20260204 ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_catalog_backup_admin ON public.seller_catalog_backup_20260204 FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.commission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_overrides_admin ON public.commission_overrides FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.seller_commission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_commission_overrides_admin ON public.seller_commission_overrides FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_reservations_admin ON public.stock_reservations FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
