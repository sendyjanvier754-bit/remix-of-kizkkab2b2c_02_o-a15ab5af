-- ============================================================
-- PORTAL DE AGENTES DE COMPRA - PARTE 3
-- Funciones RPC
-- ============================================================

-- Función: Asignar PO automáticamente al agente con menos carga y del país correcto
CREATE OR REPLACE FUNCTION public.auto_assign_po_to_agent(p_po_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent_id UUID;
    v_agent_name TEXT;
    v_origin_country TEXT;
    v_assignment_id UUID;
BEGIN
    -- Determinar el país de origen dominante de los productos en la PO
    SELECT COALESCE(p.origin_country, 'CN')
    INTO v_origin_country
    FROM orders_b2b o
    JOIN order_items_b2b oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.master_po_id = p_po_id
    GROUP BY p.origin_country
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    v_origin_country := COALESCE(v_origin_country, 'CN');
    
    -- Buscar agente activo del país con menos POs activas
    SELECT pa.id, pa.full_name
    INTO v_agent_id, v_agent_name
    FROM purchasing_agents pa
    WHERE pa.status = 'active'
      AND pa.country_code = v_origin_country
      AND pa.current_active_pos < pa.max_concurrent_pos
    ORDER BY pa.current_active_pos ASC, pa.avg_dispatch_hours ASC
    LIMIT 1;
    
    -- Si no hay agente del país, buscar cualquier agente activo
    IF v_agent_id IS NULL THEN
        SELECT pa.id, pa.full_name
        INTO v_agent_id, v_agent_name
        FROM purchasing_agents pa
        WHERE pa.status = 'active'
          AND pa.current_active_pos < pa.max_concurrent_pos
        ORDER BY pa.current_active_pos ASC
        LIMIT 1;
    END IF;
    
    IF v_agent_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay agentes disponibles');
    END IF;
    
    -- Crear asignación
    INSERT INTO po_agent_assignments (po_id, agent_id, assignment_type, status)
    VALUES (p_po_id, v_agent_id, 'auto', 'assigned')
    ON CONFLICT (po_id, agent_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_assignment_id;
    
    -- Actualizar contador del agente
    UPDATE purchasing_agents
    SET current_active_pos = current_active_pos + 1, updated_at = NOW()
    WHERE id = v_agent_id;
    
    -- Actualizar PO
    UPDATE master_purchase_orders
    SET assigned_agent_id = v_agent_id, assignment_status = 'assigned', updated_at = NOW()
    WHERE id = p_po_id;
    
    -- Crear registro de conciliación
    INSERT INTO po_reconciliation (po_id)
    VALUES (p_po_id)
    ON CONFLICT (po_id) DO NOTHING;
    
    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'agent_id', v_agent_id,
        'agent_name', v_agent_name,
        'origin_country', v_origin_country
    );
END;
$$;

-- Función: Actualizar reconciliación de PO
CREATE OR REPLACE FUNCTION public.update_po_reconciliation(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items_requested INTEGER;
    v_items_purchased INTEGER;
    v_items_received INTEGER;
    v_items_qc_approved INTEGER;
    v_items_qc_rejected INTEGER;
    v_expected_product_cost NUMERIC;
    v_actual_product_cost NUMERIC;
    v_expected_shipping_cost NUMERIC;
    v_actual_shipping_cost NUMERIC;
BEGIN
    SELECT COALESCE(SUM(oi.cantidad), 0)
    INTO v_items_requested
    FROM orders_b2b o
    JOIN order_items_b2b oi ON oi.order_id = o.id
    WHERE o.master_po_id = p_po_id;
    
    SELECT 
        COALESCE(SUM(pi.quantity), 0),
        COALESCE(SUM(CASE WHEN pi.qc_status IN ('received', 'approved', 'rejected') THEN pi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pi.qc_status = 'approved' THEN pi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pi.qc_status = 'rejected' THEN pi.quantity ELSE 0 END), 0)
    INTO v_items_purchased, v_items_received, v_items_qc_approved, v_items_qc_rejected
    FROM po_purchases pp
    JOIN po_purchase_items pi ON pi.purchase_id = pp.id
    WHERE pp.po_id = p_po_id;
    
    SELECT COALESCE(SUM(pp.expected_cost_usd), 0), COALESCE(SUM(pp.actual_cost_usd), 0)
    INTO v_expected_product_cost, v_actual_product_cost
    FROM po_purchases pp WHERE pp.po_id = p_po_id;
    
    SELECT COALESCE(SUM(ps.expected_shipping_cost_usd), 0), COALESCE(SUM(ps.actual_shipping_cost_usd), 0)
    INTO v_expected_shipping_cost, v_actual_shipping_cost
    FROM po_shipments ps WHERE ps.po_id = p_po_id;
    
    INSERT INTO po_reconciliation (
        po_id, items_requested, items_purchased, items_received, items_qc_approved, items_qc_rejected,
        items_pending_rebuy, purchase_completion_percent, qc_approval_percent, reconciliation_percent,
        total_expected_product_cost_usd, total_actual_product_cost_usd,
        total_expected_shipping_cost_usd, total_actual_shipping_cost_usd,
        total_variance_usd, is_fully_reconciled, can_generate_shipment, last_updated_at
    )
    VALUES (
        p_po_id, v_items_requested, v_items_purchased, v_items_received, v_items_qc_approved, v_items_qc_rejected,
        v_items_qc_rejected,
        CASE WHEN v_items_requested > 0 THEN (v_items_purchased::NUMERIC / v_items_requested * 100) ELSE 0 END,
        CASE WHEN v_items_received > 0 THEN (v_items_qc_approved::NUMERIC / v_items_received * 100) ELSE 0 END,
        CASE WHEN v_items_requested > 0 THEN (v_items_qc_approved::NUMERIC / v_items_requested * 100) ELSE 0 END,
        v_expected_product_cost, v_actual_product_cost, v_expected_shipping_cost, v_actual_shipping_cost,
        (v_actual_product_cost - v_expected_product_cost) + (v_actual_shipping_cost - v_expected_shipping_cost),
        v_items_qc_approved >= v_items_requested AND v_items_qc_rejected = 0,
        v_items_qc_approved >= v_items_requested AND v_items_qc_rejected = 0,
        NOW()
    )
    ON CONFLICT (po_id) DO UPDATE SET
        items_requested = EXCLUDED.items_requested, items_purchased = EXCLUDED.items_purchased,
        items_received = EXCLUDED.items_received, items_qc_approved = EXCLUDED.items_qc_approved,
        items_qc_rejected = EXCLUDED.items_qc_rejected, items_pending_rebuy = EXCLUDED.items_pending_rebuy,
        purchase_completion_percent = EXCLUDED.purchase_completion_percent,
        qc_approval_percent = EXCLUDED.qc_approval_percent,
        reconciliation_percent = EXCLUDED.reconciliation_percent,
        total_expected_product_cost_usd = EXCLUDED.total_expected_product_cost_usd,
        total_actual_product_cost_usd = EXCLUDED.total_actual_product_cost_usd,
        total_expected_shipping_cost_usd = EXCLUDED.total_expected_shipping_cost_usd,
        total_actual_shipping_cost_usd = EXCLUDED.total_actual_shipping_cost_usd,
        total_variance_usd = EXCLUDED.total_variance_usd,
        is_fully_reconciled = EXCLUDED.is_fully_reconciled,
        can_generate_shipment = EXCLUDED.can_generate_shipment,
        last_updated_at = NOW();
END;
$$;

-- Función: Calcular KPI de tiempo de despacho del agente
CREATE OR REPLACE FUNCTION public.update_agent_dispatch_kpi(p_agent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avg_hours NUMERIC;
    v_total_completed INTEGER;
BEGIN
    SELECT AVG(dispatch_hours), COUNT(*)
    INTO v_avg_hours, v_total_completed
    FROM po_agent_assignments
    WHERE agent_id = p_agent_id AND status = 'completed' AND dispatch_hours IS NOT NULL;
    
    UPDATE purchasing_agents
    SET avg_dispatch_hours = COALESCE(v_avg_hours, 0),
        total_pos_completed = COALESCE(v_total_completed, 0),
        updated_at = NOW()
    WHERE id = p_agent_id;
END;
$$;

-- Función: Obtener dashboard de agente
CREATE OR REPLACE FUNCTION public.get_agent_dashboard(p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_active_assignments INTEGER;
    v_pending_purchases INTEGER;
    v_pending_qc INTEGER;
    v_pending_shipments INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_active_assignments
    FROM po_agent_assignments
    WHERE agent_id = p_agent_id AND status IN ('assigned', 'in_progress');
    
    SELECT COUNT(*) INTO v_pending_purchases
    FROM po_purchases
    WHERE agent_id = p_agent_id AND status IN ('draft', 'cart_submitted', 'payment_pending');
    
    SELECT COUNT(*) INTO v_pending_qc
    FROM po_purchase_items pi
    JOIN po_purchases pp ON pp.id = pi.purchase_id
    WHERE pp.agent_id = p_agent_id AND pi.qc_status = 'pending';
    
    SELECT COUNT(*) INTO v_pending_shipments
    FROM po_shipments
    WHERE agent_id = p_agent_id AND status IN ('preparing', 'freight_pending', 'ready_to_ship');
    
    SELECT jsonb_build_object(
        'active_assignments', v_active_assignments,
        'pending_purchases', v_pending_purchases,
        'pending_qc', v_pending_qc,
        'pending_shipments', v_pending_shipments,
        'agent', to_jsonb(pa.*)
    )
    INTO v_result
    FROM purchasing_agents pa
    WHERE pa.id = p_agent_id;
    
    RETURN v_result;
END;
$$;