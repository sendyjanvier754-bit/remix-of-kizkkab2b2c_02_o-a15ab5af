-- ============================================================================
-- B2B MULTITRAMO ENGINE - MIGRATION PART 2: RPC FUNCTIONS
-- ============================================================================

-- 1. FUNCIÓN: calculate_b2b_price_multitramo
CREATE OR REPLACE FUNCTION public.calculate_b2b_price_multitramo(
  p_product_id UUID,
  p_address_id UUID,
  p_tier_type VARCHAR DEFAULT 'standard',
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_address RECORD;
  v_zone RECORD;
  v_tier RECORD;
  v_shipping_class RECORD;
  v_peso_total_g NUMERIC;
  v_peso_kg NUMERIC;
  v_peso_lb NUMERIC;
  v_peso_facturable_kg NUMERIC;
  v_peso_facturable_lb NUMERIC;
  v_peso_volumetrico_kg NUMERIC;
  v_costo_fabrica NUMERIC;
  v_costo_tramo_a NUMERIC;
  v_costo_tramo_b NUMERIC;
  v_recargo_zona NUMERIC;
  v_recargo_oversize NUMERIC;
  v_recargo_sensible NUMERIC;
  v_platform_fee NUMERIC;
  v_precio_aterrizado NUMERIC;
  v_precio_unitario NUMERIC;
  v_eta_min INTEGER;
  v_eta_max INTEGER;
  v_result JSONB;
BEGIN
  SELECT p.id, p.costo_base_excel,
    COALESCE(p.weight_g, COALESCE(p.weight_kg, 0) * 1000) as weight_g,
    COALESCE(p.length_cm, 0) as length_cm,
    COALESCE(p.width_cm, 0) as width_cm,
    COALESCE(p.height_cm, 0) as height_cm
  INTO v_product FROM products p WHERE p.id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Producto no encontrado');
  END IF;
  
  IF v_product.weight_g <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Producto sin peso configurado');
  END IF;
  
  v_costo_fabrica := COALESCE(v_product.costo_base_excel, 0);
  
  SELECT a.id, a.country, c.id as commune_id, c.shipping_zone_id, d.code as department_code
  INTO v_address
  FROM addresses a
  LEFT JOIN communes c ON c.id::text = a.city OR c.name = a.city
  LEFT JOIN departments d ON c.department_id = d.id
  WHERE a.id = p_address_id;
  
  IF v_address IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Dirección no encontrada');
  END IF;
  
  SELECT * INTO v_zone FROM shipping_zones sz
  WHERE sz.id = v_address.shipping_zone_id AND sz.coverage_active = true;
  
  IF v_zone IS NULL THEN
    SELECT sz.* INTO v_zone FROM shipping_zones sz
    JOIN destination_countries dc ON sz.country_id = dc.id
    WHERE dc.code = 'HT' AND sz.is_capital = true AND sz.coverage_active = true LIMIT 1;
  END IF;
  
  IF v_zone IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Sin cobertura logística en esta zona');
  END IF;
  
  SELECT st.* INTO v_tier FROM shipping_tiers st
  JOIN shipping_routes sr ON st.route_id = sr.id
  JOIN markets m ON sr.id = m.shipping_route_id
  JOIN destination_countries dc ON m.destination_country_id = dc.id
  WHERE dc.id = v_zone.country_id AND st.tier_type = p_tier_type AND st.is_active = true LIMIT 1;
  
  IF v_tier IS NULL THEN
    v_tier := ROW(gen_random_uuid(), NULL, 'standard', 'Envío Estándar', NULL, 
                  8.0, 5.0, 15, 25, 5.0, 3.0, 3, 7, true, true, true, 1, now(), now())::shipping_tiers;
  END IF;
  
  SELECT * INTO v_shipping_class FROM product_shipping_classes WHERE product_id = p_product_id;
  
  v_peso_total_g := v_product.weight_g * p_quantity;
  v_peso_kg := v_peso_total_g / 1000.0;
  v_peso_lb := v_peso_total_g / 453.59237;
  v_peso_facturable_kg := GREATEST(1, CEIL(v_peso_kg));
  v_peso_facturable_lb := GREATEST(1, CEIL(v_peso_lb));
  
  IF v_shipping_class IS NOT NULL AND v_shipping_class.is_oversize THEN
    v_peso_volumetrico_kg := (v_product.length_cm * v_product.width_cm * v_product.height_cm * p_quantity) 
                            / COALESCE(v_shipping_class.volume_factor, 5000);
    IF v_peso_volumetrico_kg > v_peso_kg THEN
      v_peso_facturable_kg := GREATEST(1, CEIL(v_peso_volumetrico_kg));
      v_peso_facturable_lb := GREATEST(1, CEIL(v_peso_volumetrico_kg * 2.20462));
    END IF;
  END IF;
  
  v_costo_tramo_a := GREATEST(COALESCE(v_tier.tramo_a_min_cost, 5), v_peso_facturable_kg * COALESCE(v_tier.tramo_a_cost_per_kg, 8));
  v_costo_tramo_b := GREATEST(COALESCE(v_tier.tramo_b_min_cost, 3), v_peso_facturable_lb * COALESCE(v_tier.tramo_b_cost_per_lb, 5));
  
  v_recargo_zona := (v_costo_tramo_a + v_costo_tramo_b) * (COALESCE(v_zone.surcharge_percent, 0) / 100.0);
  
  v_recargo_oversize := 0;
  IF v_shipping_class IS NOT NULL AND v_shipping_class.is_oversize THEN
    v_recargo_oversize := (v_costo_tramo_a + v_costo_tramo_b) * (COALESCE(v_shipping_class.oversize_surcharge_percent, 15) / 100.0);
  END IF;
  
  v_recargo_sensible := 0;
  IF v_shipping_class IS NOT NULL AND v_shipping_class.is_sensitive THEN
    v_recargo_sensible := v_peso_total_g * COALESCE(v_shipping_class.sensitive_surcharge_per_gram, 0.002);
  END IF;
  
  v_platform_fee := (v_costo_fabrica * p_quantity + v_costo_tramo_a + v_costo_tramo_b + v_recargo_zona + v_recargo_oversize + v_recargo_sensible) * 0.12;
  
  v_precio_aterrizado := (v_costo_fabrica * p_quantity) + v_costo_tramo_a + v_costo_tramo_b 
                        + v_recargo_zona + v_recargo_oversize + v_recargo_sensible + v_platform_fee;
  v_precio_unitario := v_precio_aterrizado / p_quantity;
  
  v_eta_min := COALESCE(v_tier.tramo_a_eta_min, 15) + COALESCE(v_tier.tramo_b_eta_min, 3) + COALESCE(v_zone.min_delivery_days, 0);
  v_eta_max := COALESCE(v_tier.tramo_a_eta_max, 25) + COALESCE(v_tier.tramo_b_eta_max, 7) + COALESCE(v_zone.max_delivery_days, 0);
  
  v_result := jsonb_build_object(
    'valid', true, 'producto_id', p_product_id, 'cantidad', p_quantity,
    'peso_total_gramos', ROUND(v_peso_total_g, 2), 'peso_kg', ROUND(v_peso_kg, 4), 'peso_lb', ROUND(v_peso_lb, 4),
    'peso_facturable_kg', v_peso_facturable_kg, 'peso_facturable_lb', v_peso_facturable_lb,
    'desglose', jsonb_build_object(
      'costo_fabrica', ROUND(v_costo_fabrica * p_quantity, 2), 'costo_fabrica_unitario', ROUND(v_costo_fabrica, 2),
      'tramo_a_china_usa_kg', ROUND(v_costo_tramo_a, 2), 'tramo_b_usa_destino_lb', ROUND(v_costo_tramo_b, 2),
      'recargo_zona', ROUND(v_recargo_zona, 2), 'recargo_oversize', ROUND(v_recargo_oversize, 2),
      'recargo_sensible', ROUND(v_recargo_sensible, 2), 'platform_fee_12pct', ROUND(v_platform_fee, 2),
      'zone_level', COALESCE(v_zone.zone_level, 1), 'zone_name', COALESCE(v_zone.zone_name, 'Default')
    ),
    'precio_aterrizado', ROUND(v_precio_aterrizado, 2), 'precio_unitario', ROUND(v_precio_unitario, 2),
    'shipping_type', p_tier_type, 'tier_name', COALESCE(v_tier.tier_name, 'Envío Estándar'),
    'eta_dias_min', v_eta_min, 'eta_dias_max', v_eta_max,
    'is_oversize', COALESCE(v_shipping_class.is_oversize, false),
    'is_sensitive', COALESCE(v_shipping_class.is_sensitive, false),
    'allows_express', COALESCE(v_shipping_class.allows_express, true)
  );
  
  RETURN v_result;
END;
$$;

-- 2. FUNCIÓN: get_shipping_options_for_address
CREATE OR REPLACE FUNCTION public.get_shipping_options_for_address(p_address_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_address RECORD; v_zone RECORD; v_options JSONB := '[]'::JSONB; v_tier RECORD;
BEGIN
  SELECT a.*, c.shipping_zone_id INTO v_address FROM addresses a
  LEFT JOIN communes c ON c.id::text = a.city OR c.name = a.city WHERE a.id = p_address_id;
  
  IF v_address IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'Dirección no encontrada', 'options', '[]'::JSONB); END IF;
  
  SELECT * INTO v_zone FROM shipping_zones WHERE id = v_address.shipping_zone_id AND coverage_active = true;
  IF v_zone IS NULL THEN SELECT sz.* INTO v_zone FROM shipping_zones sz WHERE sz.is_capital = true AND sz.coverage_active = true LIMIT 1; END IF;
  IF v_zone IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'Sin cobertura logística en esta zona', 'options', '[]'::JSONB); END IF;
  
  FOR v_tier IN SELECT st.*, sr.name as route_name FROM shipping_tiers st JOIN shipping_routes sr ON st.route_id = sr.id WHERE st.is_active = true ORDER BY st.priority_order ASC
  LOOP
    v_options := v_options || jsonb_build_object('tier_id', v_tier.id, 'tier_type', v_tier.tier_type, 'tier_name', v_tier.tier_name,
      'route_name', v_tier.route_name, 'tramo_a_cost_per_kg', v_tier.tramo_a_cost_per_kg, 'tramo_b_cost_per_lb', v_tier.tramo_b_cost_per_lb,
      'eta_min', v_tier.tramo_a_eta_min + v_tier.tramo_b_eta_min, 'eta_max', v_tier.tramo_a_eta_max + v_tier.tramo_b_eta_max,
      'allows_oversize', v_tier.allows_oversize, 'allows_sensitive', v_tier.allows_sensitive, 'zone_surcharge_percent', v_zone.surcharge_percent);
  END LOOP;
  
  IF jsonb_array_length(v_options) = 0 THEN
    v_options := jsonb_build_array(
      jsonb_build_object('tier_id', null, 'tier_type', 'standard', 'tier_name', 'Envío Estándar', 'tramo_a_cost_per_kg', 8.0, 'tramo_b_cost_per_lb', 5.0, 'eta_min', 18, 'eta_max', 32, 'allows_oversize', true, 'allows_sensitive', true, 'zone_surcharge_percent', v_zone.surcharge_percent),
      jsonb_build_object('tier_id', null, 'tier_type', 'express', 'tier_name', 'Envío Express', 'tramo_a_cost_per_kg', 15.0, 'tramo_b_cost_per_lb', 8.0, 'eta_min', 10, 'eta_max', 18, 'allows_oversize', false, 'allows_sensitive', true, 'zone_surcharge_percent', v_zone.surcharge_percent)
    );
  END IF;
  
  RETURN jsonb_build_object('valid', true, 'zone_id', v_zone.id, 'zone_name', v_zone.zone_name, 'zone_level', v_zone.zone_level, 'surcharge_percent', v_zone.surcharge_percent, 'options', v_options);
END;
$$;

-- 3. FUNCIÓN: validate_product_for_shipping
CREATE OR REPLACE FUNCTION public.validate_product_for_shipping(p_product_id UUID, p_tier_type VARCHAR DEFAULT 'standard')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_product RECORD; v_shipping_class RECORD; v_errors TEXT[] := '{}'; v_warnings TEXT[] := '{}';
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF v_product IS NULL THEN RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Producto no encontrado'], 'warnings', '{}'); END IF;
  IF COALESCE(v_product.weight_g, COALESCE(v_product.weight_kg, 0) * 1000) <= 0 THEN v_errors := array_append(v_errors, 'Producto sin peso configurado'); END IF;
  SELECT * INTO v_shipping_class FROM product_shipping_classes WHERE product_id = p_product_id;
  IF p_tier_type = 'express' AND v_shipping_class IS NOT NULL AND v_shipping_class.is_oversize THEN v_errors := array_append(v_errors, 'Productos oversize no permiten envío Express'); END IF;
  IF v_shipping_class IS NOT NULL AND v_shipping_class.is_sensitive THEN v_warnings := array_append(v_warnings, 'Producto sensible - recargo adicional'); END IF;
  IF v_shipping_class IS NOT NULL AND v_shipping_class.is_oversize THEN v_warnings := array_append(v_warnings, 'Producto oversize - peso volumétrico puede aplicar'); END IF;
  RETURN jsonb_build_object('valid', array_length(v_errors, 1) IS NULL, 'errors', v_errors, 'warnings', v_warnings,
    'is_oversize', COALESCE(v_shipping_class.is_oversize, false), 'is_sensitive', COALESCE(v_shipping_class.is_sensitive, false), 'allows_express', COALESCE(v_shipping_class.allows_express, true));
END;
$$;

-- 4. FUNCIÓN: close_po_and_open_new
CREATE OR REPLACE FUNCTION public.close_po_and_open_new(p_po_id UUID, p_close_reason VARCHAR DEFAULT 'manual')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old_po RECORD; v_new_po_id UUID; v_new_po_number VARCHAR; v_orders_updated INTEGER := 0; v_order RECORD;
BEGIN
  SELECT * INTO v_old_po FROM master_purchase_orders WHERE id = p_po_id AND status = 'open';
  IF v_old_po IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'PO no encontrada o ya cerrada'); END IF;
  
  UPDATE master_purchase_orders SET status = 'closed', closed_at = NOW(), close_reason = p_close_reason,
    orders_at_close = (SELECT COUNT(*) FROM orders_b2b WHERE master_po_id = p_po_id) WHERE id = p_po_id;
  
  FOR v_order IN SELECT o.*, a.country, c.code as commune_code, d.code as department_code
    FROM orders_b2b o LEFT JOIN addresses a ON o.shipping_address_id = a.id
    LEFT JOIN communes c ON c.name = a.city LEFT JOIN departments d ON c.department_id = d.id WHERE o.master_po_id = p_po_id
  LOOP
    UPDATE orders_b2b SET status = 'preparing',
      hybrid_tracking_id = 'HT-' || COALESCE(v_order.department_code, 'XX') || '-' || v_old_po.po_number || '-' ||
        COALESCE(v_old_po.china_tracking, 'PENDING') || '-' || COALESCE(v_old_po.hub_code, 'MIA') || '-' || LPAD((v_orders_updated + 1)::TEXT, 4, '0') ||
        CASE WHEN v_order.is_express THEN '-EXP' ELSE '' END || CASE WHEN v_order.is_oversize THEN '-OVZ' ELSE '' END || CASE WHEN v_order.is_sensitive THEN '-SEN' ELSE '' END,
      packing_instructions = CASE WHEN v_order.is_oversize THEN 'Embalaje Especial' WHEN v_order.is_sensitive THEN 'Manejo Especial' ELSE 'Caja Estándar' END
    WHERE id = v_order.id;
    v_orders_updated := v_orders_updated + 1;
  END LOOP;
  
  v_new_po_number := 'PO' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD((EXTRACT(DOY FROM NOW())::INTEGER)::TEXT, 3, '0');
  INSERT INTO master_purchase_orders (po_number, status, country_code, hub_code, cycle_start_at)
  VALUES (v_new_po_number, 'open', COALESCE(v_old_po.country_code, 'HT'), COALESCE(v_old_po.hub_code, 'MIA'), NOW()) RETURNING id INTO v_new_po_id;
  
  RETURN jsonb_build_object('success', true, 'closed_po_id', p_po_id, 'closed_po_number', v_old_po.po_number, 'orders_transitioned', v_orders_updated, 'new_po_id', v_new_po_id, 'new_po_number', v_new_po_number);
END;
$$;

-- 5. FUNCIÓN: generate_hybrid_tracking_id
CREATE OR REPLACE FUNCTION public.generate_hybrid_tracking_id(p_order_id UUID)
RETURNS VARCHAR LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_order RECORD; v_po RECORD; v_address RECORD; v_sequence INTEGER; v_tracking VARCHAR;
BEGIN
  SELECT * INTO v_order FROM orders_b2b WHERE id = p_order_id;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_po FROM master_purchase_orders WHERE id = v_order.master_po_id;
  SELECT a.*, c.code as commune_code, d.code as department_code INTO v_address
  FROM addresses a LEFT JOIN communes c ON c.name = a.city LEFT JOIN departments d ON c.department_id = d.id WHERE a.id = v_order.shipping_address_id;
  SELECT COUNT(*) + 1 INTO v_sequence FROM orders_b2b WHERE master_po_id = v_order.master_po_id AND created_at < v_order.created_at;
  
  v_tracking := 'HT-' || COALESCE(v_address.department_code, 'XX') || '-' || COALESCE(v_po.po_number, 'PENDING') || '-' ||
    COALESCE(v_po.china_tracking, 'PENDING') || '-' || COALESCE(v_po.hub_code, 'MIA') || '-' || LPAD(v_sequence::TEXT, 4, '0');
  IF v_order.is_express THEN v_tracking := v_tracking || '-EXP'; END IF;
  IF v_order.is_oversize THEN v_tracking := v_tracking || '-OVZ'; END IF;
  IF v_order.is_sensitive THEN v_tracking := v_tracking || '-SEN'; END IF;
  
  UPDATE orders_b2b SET hybrid_tracking_id = v_tracking WHERE id = p_order_id;
  RETURN v_tracking;
END;
$$;