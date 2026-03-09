-- ============================================================
-- PORTAL DE AGENTES DE COMPRA - PARTE 2
-- Tablas de envíos, reconciliación y funciones RPC
-- ============================================================

-- 5. Consolidación de Envío Internacional
CREATE TABLE IF NOT EXISTS public.po_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.purchasing_agents(id),
    shipment_number TEXT NOT NULL UNIQUE,
    actual_weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
    length_cm NUMERIC(10,2),
    width_cm NUMERIC(10,2),
    height_cm NUMERIC(10,2),
    volumetric_weight_kg NUMERIC(10,3) DEFAULT 0,
    billable_weight_kg NUMERIC(10,3) DEFAULT 0,
    scale_photo_url TEXT,
    dimensions_photo_url TEXT,
    package_photos TEXT[] DEFAULT '{}',
    expected_shipping_cost_usd NUMERIC(12,2),
    actual_shipping_cost_usd NUMERIC(12,2),
    freight_payment_link TEXT,
    freight_payment_proof_url TEXT,
    freight_payment_status TEXT DEFAULT 'pending' CHECK (freight_payment_status IN ('pending', 'awaiting_validation', 'paid', 'rejected')),
    freight_validated_at TIMESTAMPTZ,
    freight_validated_by UUID REFERENCES auth.users(id),
    international_tracking TEXT,
    tracking_uploaded_at TIMESTAMPTZ,
    carrier_name TEXT,
    estimated_arrival DATE,
    packing_list_url TEXT,
    packing_list_generated_at TIMESTAMPTZ,
    status TEXT DEFAULT 'preparing' CHECK (status IN ('preparing', 'freight_pending', 'ready_to_ship', 'shipped', 'in_transit', 'arrived', 'delivered')),
    shipped_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_shipments_po ON public.po_shipments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_shipments_agent ON public.po_shipments(agent_id);
CREATE INDEX IF NOT EXISTS idx_po_shipments_status ON public.po_shipments(status);
CREATE INDEX IF NOT EXISTS idx_po_shipments_tracking ON public.po_shipments(international_tracking);

-- 6. Items en cada Envío
CREATE TABLE IF NOT EXISTS public.po_shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.po_shipments(id) ON DELETE CASCADE,
    purchase_item_id UUID NOT NULL REFERENCES public.po_purchase_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    weight_kg NUMERIC(10,3),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON public.po_shipment_items(shipment_id);

-- 7. Panel de Auditoría / Conciliación
CREATE TABLE IF NOT EXISTS public.po_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE UNIQUE,
    items_requested INTEGER DEFAULT 0,
    items_purchased INTEGER DEFAULT 0,
    items_received INTEGER DEFAULT 0,
    items_qc_approved INTEGER DEFAULT 0,
    items_qc_rejected INTEGER DEFAULT 0,
    items_pending_rebuy INTEGER DEFAULT 0,
    purchase_completion_percent NUMERIC(5,2) DEFAULT 0,
    qc_approval_percent NUMERIC(5,2) DEFAULT 0,
    reconciliation_percent NUMERIC(5,2) DEFAULT 0,
    total_expected_product_cost_usd NUMERIC(14,2) DEFAULT 0,
    total_actual_product_cost_usd NUMERIC(14,2) DEFAULT 0,
    total_expected_shipping_cost_usd NUMERIC(14,2) DEFAULT 0,
    total_actual_shipping_cost_usd NUMERIC(14,2) DEFAULT 0,
    total_variance_usd NUMERIC(14,2) DEFAULT 0,
    is_fully_reconciled BOOLEAN DEFAULT FALSE,
    can_generate_shipment BOOLEAN DEFAULT FALSE,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_reconciliation_po ON public.po_reconciliation(po_id);

-- 8. Acceso de Inversionistas a QC
CREATE TABLE IF NOT EXISTS public.investor_qc_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_item_id UUID NOT NULL REFERENCES public.po_purchase_items(id) ON DELETE CASCADE,
    can_view_qc BOOLEAN DEFAULT TRUE,
    can_view_costs BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(investor_user_id, purchase_item_id)
);

-- 9. Añadir campos a productos y PO master
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS origin_country TEXT DEFAULT 'CN';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS origin_country_name TEXT DEFAULT 'China';
ALTER TABLE public.master_purchase_orders ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;
ALTER TABLE public.master_purchase_orders ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unassigned';
ALTER TABLE public.master_purchase_orders ADD COLUMN IF NOT EXISTS total_expected_cost_usd NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.master_purchase_orders ADD COLUMN IF NOT EXISTS total_actual_cost_usd NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.master_purchase_orders ADD COLUMN IF NOT EXISTS cost_variance_usd NUMERIC(14,2) DEFAULT 0;